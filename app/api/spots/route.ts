import { NextRequest, NextResponse } from "next/server";
import { MOCK_SPOTS } from "@/lib/spots-data";
import { getAreaBasedList, getBarrierFreeList } from "@/lib/tourism-api";
import { mapTourismToWorkSpot, mapBarrierFreeToWorkSpot } from "@/lib/tourism-mapper";
import { estimateCongestion } from "@/lib/utils";
import { WorkSpot } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const noise = searchParams.get("noise");
  const wifi = searchParams.get("wifi");
  const power = searchParams.get("power");
  const barrierFree = searchParams.get("barrierFree");

  let spots: WorkSpot[];

  try {
    const [tourismResult, barrierFreeResult] = await Promise.allSettled([
      getAreaBasedList("32", "1", "39"),
      getBarrierFreeList("32", "1"),
    ]);

    const regularSpots =
      tourismResult.status === "fulfilled" && tourismResult.value.length > 0
        ? tourismResult.value.map(mapTourismToWorkSpot)
        : MOCK_SPOTS;

    const bfSpots =
      barrierFreeResult.status === "fulfilled" && barrierFreeResult.value.length > 0
        ? barrierFreeResult.value.map(mapBarrierFreeToWorkSpot)
        : [];

    // 무장애 장소 contentId 집합 — 일반 목록에서 중복 제거
    const bfContentIds = new Set(bfSpots.map((s) => s.tourismContentId));
    const merged = [
      ...bfSpots,
      ...regularSpots.filter((s) => !bfContentIds.has(s.tourismContentId)),
    ];

    // 시간대 기반 예상 혼잡도 적용
    spots = merged.map((s) => ({
      ...s,
      congestion: estimateCongestion(s.id),
    }));
  } catch {
    spots = MOCK_SPOTS;
  }

  if (noise) spots = spots.filter((s) => s.noise === noise);
  if (wifi === "true") spots = spots.filter((s) => s.wifi.available);
  if (power === "true") spots = spots.filter((s) => s.power.available);
  if (barrierFree === "true") spots = spots.filter((s) => s.barrierFree !== undefined);

  return NextResponse.json({ spots });
}
