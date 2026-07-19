import { NextRequest, NextResponse } from "next/server";
import { MOCK_SPOTS } from "@/lib/spots-data";
import { getAreaBasedList, getBarrierFreeList, getCongestionMap } from "@/lib/tourism-api";
import { mapTourismToWorkSpot, mapBarrierFreeToWorkSpot } from "@/lib/tourism-mapper";
import { getKakaoCafes } from "@/lib/kakao-local-api";
import { estimateCongestion, isBarrierFree } from "@/lib/utils";
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const noise = searchParams.get("noise");
  const wifi = searchParams.get("wifi");
  const power = searchParams.get("power");
  const barrierFree = searchParams.get("barrierFree");
  const startHourParam = searchParams.get("startHour");

  // 방문 예정 시간이 주어지면 "지금 이 순간"이 아니라 그 시간대 기준으로 혼잡도를 추정한다.
  let plannedTime: Date | undefined;
  if (startHourParam !== null) {
    const hour = Number(startHourParam);
    if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
      plannedTime = new Date();
      plannedTime.setHours(hour, 0, 0, 0);
    }
  }

  let spots: WorkSpot[];

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

    spots = [...overridden, ...missingVerified];
  } catch {
    spots = [...MOCK_SPOTS, ...VERIFIED_SPOTS];
  }

  if (noise) spots = spots.filter((s) => s.noise === noise);
  if (wifi === "true") spots = spots.filter((s) => s.wifi.available);
  if (power === "true") spots = spots.filter((s) => s.power.level === "충분함" || s.power.level === "제한적");
  if (barrierFree === "true") spots = spots.filter((s) => isBarrierFree(s.barrierFree));

  return NextResponse.json({ spots });
}
