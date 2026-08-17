import { BeachIndexEntry, LifeSpot } from "@/types";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/spot-visuals";
import MapDetailPanel from "./MapDetailPanel";

// "2026-08-17" → "8월 17일". announcedDate·각 날짜 그룹 라벨에 공통으로 쓴다(AC4, "실시간"
// 대신 발표 기준 날짜를 명시).
function formatBeachDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

// 당일~+2일은 오전/오후 두 건, 이후 4일은 "일" 단일 건으로 온다(2026-08-17 실호출로 확인,
// AC1/AC5) — 이 함수가 그 두 형태를 하나의 요약 문자열로 흡수해 UI가 깨지지 않게 한다.
// 이번 라운드(UI 리디자인)에서 이 함수의 출력값은 변경하지 않는다 — 등급 텍스트는 그대로 유지.
function summarizeBeachDay(entries: BeachIndexEntry[]): string {
  if (entries.length === 1) return entries[0].totalIndex;
  const morning = entries.find((e) => e.period === "오전");
  const afternoon = entries.find((e) => e.period === "오후");
  if (morning && afternoon) return `오전 ${morning.totalIndex} · 오후 ${afternoon.totalIndex}`;
  // 예상 밖 조합 방어(오전/오후 중 하나만 오는 등) — 있는 값만 이어붙인다.
  return entries.map((e) => `${e.period} ${e.totalIndex}`).join(" · ");
}

// 해수욕지수 이모지 매핑(설계 판단 4). KHOA 웹사이트 범례 기준 6종 외의 미지 값이 오면
// 매핑에 없으므로 undefined를 반환 — 호출부는 이 경우 이모지 없이 텍스트만 보여준다(방어 로직,
// AC6). 등급 텍스트 자체를 대체하지 않고 보조로만 붙인다.
const BEACH_INDEX_EMOJI: Record<string, string> = {
  "매우좋음": "😄",
  "좋음": "🙂",
  "보통": "😐",
  "나쁨": "🙁",
  "매우나쁨": "😟",
  "폐장": "🚫",
};

function beachIndexEmoji(totalIndex: string): string | undefined {
  return BEACH_INDEX_EMOJI[totalIndex];
}

// summarizeBeachDay와 동일한 오전/오후 결합 규칙을 그대로 따라가되, 텍스트 대신 이모지만
// 골라 붙인다 — summarizeBeachDay의 반환값(텍스트)은 이 함수와 무관하게 전혀 바뀌지 않는다.
function summarizeBeachEmoji(entries: BeachIndexEntry[]): string {
  if (entries.length === 1) return beachIndexEmoji(entries[0].totalIndex) ?? "";
  const morning = entries.find((e) => e.period === "오전");
  const afternoon = entries.find((e) => e.period === "오후");
  if (morning && afternoon) {
    return [beachIndexEmoji(morning.totalIndex), beachIndexEmoji(afternoon.totalIndex)]
      .filter((e): e is string => Boolean(e))
      .join(" ");
  }
  return entries
    .map((e) => beachIndexEmoji(e.totalIndex))
    .filter((e): e is string => Boolean(e))
    .join(" ");
}

function groupBeachEntriesByDate(
  entries: BeachIndexEntry[]
): { date: string; label: string; summary: string; emoji: string; detail: BeachIndexEntry[] }[] {
  const byDate = new Map<string, BeachIndexEntry[]>();
  for (const e of entries) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  return Array.from(byDate.entries()).map(([date, dayEntries]) => ({
    date,
    label: formatBeachDateLabel(date),
    summary: summarizeBeachDay(dayEntries),
    emoji: summarizeBeachEmoji(dayEntries),
    detail: dayEntries,
  }));
}

// 주차 잔여율 기반 색상 강조(설계 판단 5) — availLots/totalLots는 이미 실측으로 받은 숫자라,
// 이 값을 UI에서 색으로 강조하는 건 CLAUDE.md의 "없는 데이터 지어내기 금지"와 무관하다. 값 중
// 하나라도 null이면 색 강조 없이 중립 톤만 쓰고, 원본 숫자는 색과 무관하게 항상 그대로 노출한다.
function parkingRatioTone(availLots: number | null, totalLots: number | null): string {
  if (availLots === null || totalLots === null || totalLots === 0) return "text-foreground/70";
  const ratio = availLots / totalLots;
  if (ratio >= 0.3) return "text-good";
  if (ratio >= 0.1) return "text-warn";
  return "text-bad";
}

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
    <MapDetailPanel
      title={spot.name}
      category={<span className="text-xs text-foreground/60 font-medium">{categoryLabel[spot.category]}</span>}
      subtitle={<p className="text-xs text-foreground/60 mt-0.5">{spot.address}</p>}
      onClose={onClose}
    >
      {spot.description && (
        <p className="px-4 pb-3 text-sm text-foreground/70 line-clamp-3">{spot.description}</p>
      )}

      {/* 강릉시 주차 연동(2026-08-16): category "attraction"에서만 렌더링(요구사항 문서 5절).
          spot.parking이 undefined(비-attraction)면 아예 안 그리고, attraction인데 빈 배열(매칭
          없음/API 실패/키 미설정)이면 정직한 폴백 문구를 보여준다(AC3, AC5) — "실시간" 대신
          "최근 확인된 주차 현황"을 쓴다. getParkRltm 응답에 갱신 시각 필드가 없음을 실호출로
          확인했기 때문이다(AC4). 이번 라운드는 잔여면수를 큰 숫자로 강조하는 배지형 카드로
          시각만 보강한다 — availLots/totalLots 값과 폴백 문구 조건은 그대로다(설계 판단 5). */}
      {spot.category === "attraction" && (
        <div className="px-4 pb-3">
          <p className="text-xs font-semibold text-foreground/60 mb-1.5">인근 주차장</p>
          {spot.parking && spot.parking.length > 0 ? (
            <ul className="space-y-1.5">
              {spot.parking.map((lot) => (
                <li
                  key={lot.id}
                  className="flex items-center justify-between text-xs bg-muted rounded-lg px-2.5 py-2"
                >
                  <span className="text-foreground/80 truncate mr-2">{lot.name}</span>
                  {lot.availLots !== null && lot.totalLots !== null ? (
                    <span className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className={cn("text-2xl font-bold leading-none", parkingRatioTone(lot.availLots, lot.totalLots))}>
                        {lot.availLots}
                      </span>
                      <span className="text-foreground/50">/{lot.totalLots}면</span>
                    </span>
                  ) : (
                    <span className="text-foreground/60 whitespace-nowrap">잔여 정보 없음</span>
                  )}
                </li>
              ))}
              <li className="text-[11px] text-foreground/40 pt-0.5">최근 확인된 주차 현황</li>
            </ul>
          ) : (
            <p className="text-xs text-foreground/50">인근 주차 정보가 연동되지 않았어요</p>
          )}
        </div>
      )}

      {/* 국립해양조사원 해수욕지수 연동(2026-08-17): spot.beachIndex가 undefined(비-해변 명소,
          매칭 시도 안 함)면 섹션 자체를 렌더링하지 않는다(AC3). null(해변 이름이지만 KHOA
          관측 지점 없음 — 강문/안목 — 또는 API 실패/키 미설정)이면 정직한 폴백 문구를
          보여준다(AC6, parking 폴백과 동일 톤). "실시간"이라는 단어는 쓰지 않고 응답의
          predcYmd 최솟값만 "OO월 OO일 발표 기준"으로 노출한다 — API 응답 자체에 발표
          "시각" 필드가 없음을 실호출로 확인했기 때문이다(AC4, types/index.ts의 BeachIndex
          주석 참고). 이번 라운드는 등급 문자열 옆에 이모지를 보조로 붙인다 — 매핑표에 없는
          미지 값은 이모지 없이 텍스트만 노출(방어, AC6). */}
      {spot.beachIndex !== undefined && (
        <div className="px-4 pb-3">
          <p className="text-xs font-semibold text-foreground/60 mb-1.5">해수욕지수</p>
          {spot.beachIndex ? (
            <>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {groupBeachEntriesByDate(spot.beachIndex.entries).map((row) => (
                  <li
                    key={row.date}
                    className="flex items-center justify-between text-xs bg-muted rounded-lg px-2.5 py-1.5"
                  >
                    <span className="text-foreground/80 whitespace-nowrap mr-2">{row.label}</span>
                    <span className="text-foreground/60 text-right">
                      {row.summary}
                      {row.emoji && <span className="ml-1">{row.emoji}</span>}
                      {row.detail[0]?.maxWvhgtM !== null && row.detail[0]?.avgWtemC !== null && (
                        <span className="text-foreground/40">
                          {" "}
                          (파고 {row.detail[0].maxWvhgtM}m·{row.detail[0].avgWtemC}℃)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-foreground/40 pt-1">
                국립해양조사원 생활해양예보 ({formatBeachDateLabel(spot.beachIndex.announcedDate)} 발표 기준)
              </p>
            </>
          ) : (
            <p className="text-xs text-foreground/50">해수욕지수 정보가 연동되지 않았어요</p>
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
    </MapDetailPanel>
  );
}
