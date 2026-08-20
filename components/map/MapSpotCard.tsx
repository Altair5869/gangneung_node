import Link from "next/link";
import { WorkSpot } from "@/types";
import { cn, noiseLabel, congestionLabel, powerLabel, wifiLabel } from "@/lib/utils";
import { categoryLabel, noiseBadge, powerBadge } from "@/lib/spot-visuals";
import CommunityBadge from "@/components/checkin/CommunityBadge";
import MapDetailPanel from "./MapDetailPanel";

// 혼잡도 dot은 지도 마커·필터 패널 범례(KakaoMap.tsx의 CONGESTION_COLOR)와 같은 고정 hex
// 계열이어야 한다 — 마커가 카카오맵 캔버스 내부에 고정 hex로 렌더되므로, 여기서
// lib/spot-visuals.ts의 congestionStyle(good/warn/bad 토큰)을 쓰면 다크모드에서 방금 클릭한
// 마커 색과 이 dot 색이 어긋난다.
const congestionDot: Record<"low" | "medium" | "high", string> = {
  low: "bg-green-400",
  medium: "bg-yellow-400",
  high: "bg-red-400",
};

// 중립(미확인) 배지 톤. "확정된 없음"과 구분되어야 하므로 bad 계열 색을 절대 쓰지 않는다.
const NEUTRAL_BADGE = "bg-muted text-foreground/60";

export default function MapSpotCard({
  spot,
  onClose,
}: {
  spot: WorkSpot;
  onClose: () => void;
}) {
  // WiFi/콘센트는 값이 있을 때만 보여주던 조건부 렌더링을 없앤다(요구사항 2-1). 미확인 스팟에서
  // 줄이 통째로 사라지면 (a) 명소 패널 대비 카드가 빈약해 보이고 (b) "정보가 없다"는 사실 자체가
  // 사용자에게 전달되지 않는다. 문구는 lib/utils의 wifiLabel/powerLabel이 이미 "WiFi 미확인"/
  // "콘센트 미확인"을 반환하므로 그대로 쓴다 — 여기서 값을 만들거나 추정하지 않는다.
  const wifiTone =
    spot.wifi.available === true
      ? "bg-good/15 text-good"
      : spot.wifi.available === false
      ? "bg-bad/15 text-bad"
      : NEUTRAL_BADGE;
  const powerTone = spot.power.level === null ? NEUTRAL_BADGE : powerBadge[spot.power.level];

  return (
    <MapDetailPanel
      title={spot.name}
      category={
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-foreground/60 font-medium">{categoryLabel[spot.category]}</span>
          {spot.congestion && (
            <span className="flex items-center gap-1 text-xs text-foreground/70">
              <span className={cn("w-1.5 h-1.5 rounded-full", congestionDot[spot.congestion])} />
              예상 {congestionLabel(spot.congestion)}
            </span>
          )}
        </div>
      }
      subtitle={<p className="text-xs text-foreground/60 mt-0.5">{spot.address}</p>}
      onClose={onClose}
    >
      {/* 작업 환경 — 세 배지 모두 항상 렌더링(미확인이면 중립 톤). */}
      <div className="px-4 pb-3">
        <p className="text-xs font-semibold text-foreground/60 mb-1.5">작업 환경</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", wifiTone)}>
            {wifiLabel(spot.wifi.available)}
          </span>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", powerTone)}>
            {powerLabel(spot.power.level)}
          </span>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", spot.noise !== "언급없음" ? noiseBadge[spot.noise] : NEUTRAL_BADGE)}>
            {noiseLabel(spot.noise)}
          </span>
        </div>
      </div>

      {/* 영업시간 — 예전에는 {spot.openHours}만 라벨 없이 출력해서, 폴백 문자열 "정보 미제공"이
          어떤 항목에 대한 것인지 화면만 봐서는 알 수 없었다(요구사항 5-1). 값이 실제 시간일
          때도 같은 라벨+값 2단 표기를 유지한다(5-2, 비대칭 표기 금지). 폴백 문자열 자체
          (lib/tourism-mapper.ts, lib/kakao-local-api.ts의 "정보 미제공")는 건드리지 않는다 —
          이 값을 문자열 비교하는 곳은 없지만, 표시 측 라벨만으로 문제가 해소되므로 데이터
          레이어를 흔들 이유가 없다. */}
      <div className="px-4 pb-3">
        <p className="text-xs font-semibold text-foreground/60 mb-1.5">영업시간</p>
        <p className="text-xs text-foreground/70 bg-muted rounded-lg px-2.5 py-2">{spot.openHours}</p>
      </div>

      {/* 커뮤니티 검증 요약 — 상세 페이지와 같은 컴포넌트를 쓰되 compact 변형이라 체크인 0건이면
          아무것도 렌더링되지 않는다(CommunityBadge의 기존 규칙 R7-5). */}
      {spot.communityCheckin && (
        <div className="px-4 pb-3">
          <p className="text-xs font-semibold text-foreground/60 mb-1.5">커뮤니티 검증</p>
          <CommunityBadge summary={spot.communityCheckin} variant="compact" />
        </div>
      )}

      <div className="grid grid-cols-2 border-t border-border">
        <button
          onClick={onClose}
          className="py-3 text-sm text-foreground/70 hover:bg-muted transition-colors"
        >
          닫기
        </button>
        {/* 라벨을 "자세히 보기" → "상세 페이지 열기"로 바꿔 지도를 벗어난다는 사실이 드러나게 한다
            (요구사항 2-2). from=map을 붙여, 상세 페이지 뒤로가기가 목록이 아니라 지도로 돌아가게
            한다(app/spots/[id]/page.tsx). 체크인 폼·무장애 5개 필드·작업환경 점수는 패널로
            끌어오지 않고 상세 페이지에 남긴다 — PM 판단(요구사항 2번 방향 결정). */}
        <Link
          href={`/spots/${spot.id}?from=map`}
          className="py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors text-center border-l border-border"
        >
          상세 페이지 열기 →
        </Link>
      </div>
    </MapDetailPanel>
  );
}
