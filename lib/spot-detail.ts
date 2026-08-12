import { getDetailCommon, getBarrierFreeDetail } from "@/lib/tourism-api";
import { mapTourismToWorkSpot, mapBarrierFreeToWorkSpot } from "@/lib/tourism-mapper";
import { getKakaoCafes } from "@/lib/kakao-local-api";
import { VERIFIED_SPOTS, mergeVerifiedFields } from "@/lib/verified-spots";
import { getCheckinSummary } from "@/lib/community-checkin";
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

// 관광공사/카카오 API 조회 + 실측(VERIFIED_SPOTS) 병합까지만 담당하는 내부 함수(커뮤니티
// 체크인 병합 이전 단계). 아래 getSpotById가 이 함수의 결과에 communityCheckin을 덧붙인다 —
// 두 단계로 나눈 이유는 이 함수 안의 여러 return 지점(early return)마다 커뮤니티 데이터 병합을
// 각각 복붙하지 않기 위해서다(복붙하면 2026-07-28 barrierFree 병합 버그와 같은 유형이 재발한다).
async function findSpot(id: string): Promise<WorkSpot | null> {
  // 실측 데이터 전용 ID (관광공사/카카오 API에 없는 곳, 예: 도서관)
  const verifiedOnly = verifiedById.get(id);
  if (verifiedOnly) return verifiedOnly;

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
        return applyVerified(merged);
      }
    } catch {
      // fall through to null
    }
  }

  // tourism-{contentId} 형태의 ID 처리
  if (id.startsWith("tourism-")) {
    const contentId = id.replace("tourism-", "");
    try {
      const item = await getDetailCommon(contentId);
      if (item) return applyVerified(mapTourismToWorkSpot(item));
    } catch {
      // fall through to null
    }
  }

  // kakao-{placeId} 형태의 ID 처리
  if (id.startsWith("kakao-")) {
    try {
      const kakaoSpots = await getKakaoCafes();
      const spot = kakaoSpots.find((s) => s.id === id);
      if (spot) return applyVerified(spot);
    } catch {
      // fall through to null
    }
  }

  return null;
}

// 단건 스팟 조회. /api/spots/[id] 라우트와 /spots/[id] 서버 컴포넌트가 이 함수 하나를 공유한다 —
// 페이지가 자기 서버의 라우트를 HTTP로 다시 호출하던 구조(셀프 fetch)를 없애면서, 조회·병합
// 로직을 페이지에 복붙하는 대신 여기로 추출했다.
// 못 찾으면 null — 라우트는 404, 페이지는 notFound()로 변환한다.
// communityCheckin(2026-08-11 신규): Redis 집계를 읽어 요약을 붙인다. 체크인 0건이면
// summary가 undefined라 WorkSpot.communityCheckin 자체가 생략된다(R7-5, 가짜 시드 금지).
// myCheckin(로그인 사용자 본인의 최신 체크인)은 이 함수의 책임이 아니다 — 세션은 요청 컨텍스트에
// 종속적인데 이 함수는 페이지/라우트 양쪽에서 세션 유무와 무관하게 호출되므로, 호출부(라우트/
// 페이지)가 각자 auth()로 세션을 얻은 뒤 lib/community-checkin.ts의 getUserCheckin을 직접
// 호출한다.
export async function getSpotById(id: string): Promise<WorkSpot | null> {
  const spot = await findSpot(id);
  if (!spot) return null;
  const communityCheckin = await getCheckinSummary(spot.id);
  return communityCheckin ? { ...spot, communityCheckin } : spot;
}
