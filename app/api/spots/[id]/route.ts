import { NextResponse } from "next/server";
import { getSpotById, MOCK_SPOTS } from "@/lib/spots-data";
import { getDetailCommon, getBarrierFreeDetail } from "@/lib/tourism-api";
import { mapTourismToWorkSpot, mapBarrierFreeToWorkSpot } from "@/lib/tourism-mapper";
import { getKakaoCafes } from "@/lib/kakao-local-api";
import { VERIFIED_SPOTS } from "@/lib/verified-spots";
import { BarrierFreeItem, WorkSpot } from "@/types";

const verifiedById = new Map(VERIFIED_SPOTS.map((v) => [v.id, v]));
const verifiedByContentId = new Map(VERIFIED_SPOTS.map((v) => [v.tourismContentId, v]));

// 실측 데이터(24곳)가 있으면 wifi/power/noise를 그 값으로 덮어쓴다.
function applyVerified(spot: WorkSpot): WorkSpot {
  const v = spot.tourismContentId ? verifiedByContentId.get(spot.tourismContentId) : undefined;
  if (!v) return spot;
  return { ...spot, wifi: v.wifi, power: v.power, noise: v.noise, tags: Array.from(new Set([...spot.tags, ...v.tags])) };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // mock 데이터에서 먼저 탐색
  const mockSpot = getSpotById(id);
  if (mockSpot) return NextResponse.json({ spot: mockSpot });

  // 실측 데이터 전용 ID (관광공사/카카오 API에 없는 곳, 예: 도서관)
  const verifiedOnly = verifiedById.get(id);
  if (verifiedOnly) return NextResponse.json({ spot: verifiedOnly });

  // barrier-free-{contentId} 형태의 ID 처리
  if (id.startsWith("barrier-free-")) {
    const contentId = id.replace("barrier-free-", "");
    try {
      const [common, detail] = await Promise.allSettled([
        getDetailCommon(contentId),
        getBarrierFreeDetail(contentId),
      ]);
      const base = common.status === "fulfilled" && common.value ? common.value : null;
      const bfDetail = detail.status === "fulfilled" && detail.value ? detail.value : null;

      if (base) {
        const merged = bfDetail
          ? mapBarrierFreeToWorkSpot({ ...base, ...bfDetail } as BarrierFreeItem)
          : { ...mapTourismToWorkSpot(base), id, barrierFree: {} };
        return NextResponse.json({ spot: applyVerified(merged) });
      }
    } catch {
      // fall through to 404
    }
  }

  // tourism-{contentId} 형태의 ID 처리
  if (id.startsWith("tourism-")) {
    const contentId = id.replace("tourism-", "");
    try {
      const item = await getDetailCommon(contentId);
      if (item) {
        const spot = mapTourismToWorkSpot(item);
        return NextResponse.json({ spot: applyVerified(spot) });
      }
    } catch {
      // fall through to 404
    }
  }

  // kakao-{placeId} 형태의 ID 처리
  if (id.startsWith("kakao-")) {
    try {
      const kakaoSpots = await getKakaoCafes();
      const spot = kakaoSpots.find((s) => s.id === id);
      if (spot) return NextResponse.json({ spot: applyVerified(spot) });
    } catch {
      // fall through to 404
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function generateStaticParams() {
  return MOCK_SPOTS.map((s) => ({ id: s.id }));
}
