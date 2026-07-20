import { MOCK_SPOTS } from "@/lib/spots-data";
import { getAreaBasedList, getBarrierFreeList, getCongestionMap } from "@/lib/tourism-api";
import { mapTourismToWorkSpot, mapBarrierFreeToWorkSpot } from "@/lib/tourism-mapper";
import { getKakaoCafes } from "@/lib/kakao-local-api";
import { estimateCongestion } from "@/lib/utils";
import { VERIFIED_SPOTS } from "@/lib/verified-spots";
import { WorkSpot } from "@/types";

const WORKATION_KEYWORDS = [
  "카페", "커피", "coffee", "cafe",
  "코워킹", "공유오피스", "스터디",
  "도서관", "library",
  "라운지", "lounge",
  "호텔", "hotel", "리조트",
  "브루어리", "베이커리",
];

function isWorkationSpot(name: string): boolean {
  const lower = name.toLowerCase();
  return WORKATION_KEYWORDS.some((kw) => lower.includes(kw));
}

// /api/spots 라우트와 벡터 색인 재구축 작업(reindex)이 동일한 전체 워크스팟 코퍼스를
// 공유해야 하므로, 관광공사/카카오 API 병합·중복 제거·실측 데이터 오버라이드 로직을 여기 한 곳에 둔다.
export async function buildSpotCorpus(plannedTime?: Date): Promise<WorkSpot[]> {
  try {
    const [foodResult, culturalResult, accommodationResult, barrierFreeResult, kakaoCafes, congestionMap] = await Promise.allSettled([
      getAreaBasedList("32", "1", "39"), // 음식점 (카페 포함)
      getAreaBasedList("32", "1", "14"), // 문화시설 (도서관, 문화원 등)
      getAreaBasedList("32", "1", "32"), // 숙박 (호텔 라운지 등)
      getBarrierFreeList("32", "1"),
      getKakaoCafes(),
      getCongestionMap("32", "1"),
    ]);

    const rawRegular = [
      ...(foodResult.status === "fulfilled" ? foodResult.value : []),
      ...(culturalResult.status === "fulfilled" ? culturalResult.value : []),
      ...(accommodationResult.status === "fulfilled" ? accommodationResult.value : []),
    ];

    const regularSpots =
      rawRegular.length > 0
        ? rawRegular.map(mapTourismToWorkSpot).filter((s) => isWorkationSpot(s.name))
        : MOCK_SPOTS;

    const bfSpots =
      barrierFreeResult.status === "fulfilled" && barrierFreeResult.value.length > 0
        ? barrierFreeResult.value.map(mapBarrierFreeToWorkSpot).filter((s) => isWorkationSpot(s.name))
        : [];

    const kakaoSpots =
      kakaoCafes.status === "fulfilled" ? kakaoCafes.value : [];

    // 카카오 카페 ID 집합 — 이름 기준 중복 제거 (실측 데이터 24곳도 포함해, 관광공사 목록에 이번에 안 잡혀도 카카오 쪽 중복이 안 생기게 한다)
    const existingNames = new Set([
      ...bfSpots.map((s) => s.name),
      ...regularSpots.map((s) => s.name),
      ...VERIFIED_SPOTS.map((s) => s.name),
    ]);
    const deduplicatedKakao = kakaoSpots.filter((s) => !existingNames.has(s.name));

    // 무장애 장소 contentId 집합 — 일반 목록에서 중복 제거
    const bfContentIds = new Set(bfSpots.map((s) => s.tourismContentId));
    const merged = [
      ...bfSpots,
      ...regularSpots.filter((s) => !bfContentIds.has(s.tourismContentId)),
      ...deduplicatedKakao,
    ];

    // 혼잡도: 관광공사 실데이터 우선, 없으면 시간대 기반 추정
    const cMap = congestionMap.status === "fulfilled" ? congestionMap.value : new Map();
    const withCongestion = merged.map((s) => ({
      ...s,
      congestion: cMap.get(s.tourismContentId ?? "") ?? estimateCongestion(s.id, plannedTime),
    }));

    // 실측 데이터(24곳): wifi/power/noise를 전화 확인·방문·웹 스크리닝으로 확정한 값으로 덮어쓰고,
    // 관광공사/카카오 API가 이번 요청에서 못 가져온 곳(주로 도서관)은 그대로 추가한다.
    const verifiedById = new Map(VERIFIED_SPOTS.map((v) => [v.tourismContentId, v]));
    const overridden = withCongestion.map((s) => {
      const v = s.tourismContentId ? verifiedById.get(s.tourismContentId) : undefined;
      if (!v) return s;
      return {
        ...s,
        wifi: v.wifi,
        power: v.power,
        noise: v.noise,
        barrierFree: v.barrierFree ?? s.barrierFree,
        tags: Array.from(new Set([...s.tags, ...v.tags])),
      };
    });
    const presentContentIds = new Set(overridden.map((s) => s.tourismContentId).filter(Boolean));
    const missingVerified = VERIFIED_SPOTS.filter((v) => !presentContentIds.has(v.tourismContentId)).map((v) => ({
      ...v,
      congestion: cMap.get(v.tourismContentId ?? "") ?? estimateCongestion(v.id, plannedTime),
    }));

    return [...overridden, ...missingVerified];
  } catch {
    return [...MOCK_SPOTS, ...VERIFIED_SPOTS];
  }
}
