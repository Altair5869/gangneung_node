import { NextResponse } from "next/server";
import { getDetailCommon, getBarrierFreeDetail } from "@/lib/tourism-api";
import { mapTourismToWorkSpot, mapBarrierFreeToWorkSpot } from "@/lib/tourism-mapper";
import { getKakaoCafes } from "@/lib/kakao-local-api";
import { VERIFIED_SPOTS, mergeVerifiedFields } from "@/lib/verified-spots";
import { BarrierFreeItem, WorkSpot } from "@/types";

const verifiedById = new Map(VERIFIED_SPOTS.map((v) => [v.id, v]));
const verifiedByContentId = new Map(VERIFIED_SPOTS.map((v) => [v.tourismContentId, v]));

// 실측 데이터(24곳)가 있으면 wifi/power/noise/barrierFree를 그 값으로 덮어쓴다.
// lib/spot-corpus.ts의 buildSpotCorpus와 동일한 병합 로직(mergeVerifiedFields)을 공유한다 —
// 필드 목록이 두 곳에서 따로 유지되면 한쪽만 고칠 때 다시 어긋날 수 있어서다(2026-07-28 버그 수정).
function applyVerified(spot: WorkSpot): WorkSpot {
  const v = spot.tourismContentId ? verifiedByContentId.get(spot.tourismContentId) : undefined;
  return mergeVerifiedFields(spot, v);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
