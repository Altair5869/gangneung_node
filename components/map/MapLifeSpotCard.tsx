import { LifeSpot } from "@/types";
import { categoryLabel } from "@/lib/spot-visuals";

// WorkSpot 전용 MapSpotCard(wifi/power/noise/openHours 배지, /spots/[id] 링크)를 LifeSpot에
// 그대로 못 쓴다 — LifeSpot 타입엔 이 필드들이 아예 없고, /attraction/[id] 같은 상세 페이지도
// 존재하지 않는다(요구사항 문서 3번, AC5). 그래서 이름/카테고리/주소/설명만 보여주는 경량 카드를
// 별도로 둔다. "자세히 보기" 같은 링크는 의도적으로 넣지 않는다 — 깨진 링크를 만들 바에야 없는
// 게 낫다.
export default function MapLifeSpotCard({
  spot,
  onClose,
}: {
  spot: LifeSpot;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-background rounded-2xl shadow-xl border border-border z-10 overflow-hidden">
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <span className="text-xs text-foreground/60 font-medium">{categoryLabel[spot.category]}</span>
          <h3 className="font-bold text-foreground text-base">{spot.name}</h3>
          <p className="text-xs text-foreground/60 mt-0.5">{spot.address}</p>
        </div>
        <button
          onClick={onClose}
          className="text-foreground/50 hover:text-foreground transition-colors ml-2 mt-0.5"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {spot.description && (
        <p className="px-4 pb-3 text-sm text-foreground/70 line-clamp-3">{spot.description}</p>
      )}

      {/* 강릉시 주차 연동(2026-08-16): category "attraction"에서만 렌더링(요구사항 문서 5절).
          spot.parking이 undefined(비-attraction)면 아예 안 그리고, attraction인데 빈 배열(매칭
          없음/API 실패/키 미설정)이면 정직한 폴백 문구를 보여준다(AC3, AC5) — "실시간" 대신
          "최근 확인된 주차 현황"을 쓴다. getParkRltm 응답에 갱신 시각 필드가 없음을 실호출로
          확인했기 때문이다(AC4). */}
      {spot.category === "attraction" && (
        <div className="px-4 pb-3">
          <p className="text-xs font-semibold text-foreground/60 mb-1.5">인근 주차장</p>
          {spot.parking && spot.parking.length > 0 ? (
            <ul className="space-y-1">
              {spot.parking.map((lot) => (
                <li
                  key={lot.id}
                  className="flex items-center justify-between text-xs bg-muted rounded-lg px-2.5 py-1.5"
                >
                  <span className="text-foreground/80 truncate mr-2">{lot.name}</span>
                  <span className="text-foreground/60 whitespace-nowrap">
                    {lot.availLots !== null && lot.totalLots !== null
                      ? `잔여 ${lot.availLots}/${lot.totalLots}면`
                      : "잔여 정보 없음"}
                  </span>
                </li>
              ))}
              <li className="text-[11px] text-foreground/40 pt-0.5">최근 확인된 주차 현황</li>
            </ul>
          ) : (
            <p className="text-xs text-foreground/50">인근 주차 정보가 연동되지 않았어요</p>
          )}
        </div>
      )}

      <div className="border-t border-border">
        <button
          onClick={onClose}
          className="w-full py-3 text-sm text-foreground/70 hover:bg-muted transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
