import {
  getAreaBasedList,
  getBarrierFreeList,
  getCongestionMap,
  getAttractionList,
  getFoodList,
  getStayList,
  getLocationBasedList,
  getEventList,
} from "@/lib/tourism-api";
import { mapTourismToWorkSpot, mapBarrierFreeToWorkSpot, mapTourismToLifeSpot, mapTourismToFoodSpot, mapTourismToStaySpot, mapEventToLifeSpot } from "@/lib/tourism-mapper";
import { getKakaoCafes, getKakaoRestaurants } from "@/lib/kakao-local-api";
import { estimateCongestion, looksLikeCafe } from "@/lib/utils";
import { VERIFIED_SPOTS, mergeVerifiedFields } from "@/lib/verified-spots";
import { getCheckinSummaries } from "@/lib/community-checkin";
import { calculateHaversineDistance } from "@/lib/ai";
import { WorkSpot, LifeSpot, TourismApiItem, CommunityCheckinSummary } from "@/types";

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
        : VERIFIED_SPOTS;

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

    // 실측 데이터(24곳): wifi/power/noise/barrierFree를 전화 확인·방문·웹 스크리닝으로 확정한 값으로
    // 덮어쓰고, 관광공사/카카오 API가 이번 요청에서 못 가져온 곳(주로 도서관)은 그대로 추가한다.
    // 병합 로직 자체는 lib/verified-spots.ts의 mergeVerifiedFields로 공유해, 단건 조회
    // (lib/spot-detail.ts의 getSpotById)와 필드 목록이 어긋나지 않게 한다(2026-07-28 버그 수정).
    const verifiedById = new Map(VERIFIED_SPOTS.map((v) => [v.tourismContentId, v]));
    const overridden = withCongestion.map((s) => {
      const v = s.tourismContentId ? verifiedById.get(s.tourismContentId) : undefined;
      return mergeVerifiedFields(s, v);
    });
    const presentContentIds = new Set(overridden.map((s) => s.tourismContentId).filter(Boolean));
    const missingVerified = VERIFIED_SPOTS.filter((v) => !presentContentIds.has(v.tourismContentId)).map((v) => ({
      ...v,
      congestion: cMap.get(v.tourismContentId ?? "") ?? estimateCongestion(v.id, plannedTime),
    }));

    const allSpots = [...overridden, ...missingVerified];

    // 커뮤니티 체크인 요약(2026-08-11 신규, R5-3): 스팟 200여 곳에 개별 Redis 요청을 보내지
    // 않고 파이프라인 1회 왕복으로 일괄 조회한다(getCheckinSummaries가 내부에서 처리, N+1 금지).
    // 이 조회가 실패해도 관광공사/카카오 데이터는 이미 확보했으므로, 바깥 catch로 전체를
    // VERIFIED_SPOTS까지 축소시키지 않고 이 단계만 조용히 건너뛴다.
    let summaries = new Map<string, CommunityCheckinSummary>();
    try {
      summaries = await getCheckinSummaries(allSpots.map((s) => s.id));
    } catch (error) {
      console.error("[spot-corpus] community checkin summary fetch failed:", error);
    }
    if (summaries.size === 0) return allSpots;

    return allSpots.map((s) => {
      const communityCheckin = summaries.get(s.id);
      return communityCheckin ? { ...s, communityCheckin } : s;
    });
  } catch {
    return VERIFIED_SPOTS;
  }
}

const hasValidCoords = (item: TourismApiItem): boolean =>
  Boolean(item.mapx) && Boolean(item.mapy) && parseFloat(item.mapx) !== 0;

// R1(2026-08-13): 관광공사 food(getFoodList) 결과가 못 잡는 가게가 실제로 있다("뉴솔향초당순두부"
// 등, 관광공사 미등록). 카카오 FD6(getKakaoRestaurants)로 보강하되, 같은 가게가 두 소스에 다른
// 표기로 각각 등록돼 있으면 중복 노출된다 — lib/ai.ts:332~344의 looksSamePlace/normalizeName
// 패턴(50m 이내 + 이름 포함관계)을 LifeSpot vs LifeSpot용으로 시그니처만 바꿔 재사용한다.
// lib/ai.ts가 export하는 건 calculateHaversineDistance뿐이라(원본 함수들은 모듈 비공개) 정규화·
// 판정 로직 자체는 여기 새로 작성한다 — 상수(50m)와 판정 기준은 원본과 동일하게 유지.
const FOOD_SAME_PLACE_KM = 0.05;

function normalizeFoodName(name: string): string {
  return name.toLowerCase().replace(/[\s()\-·.,'"]/g, "");
}

function looksSameFoodPlace(a: LifeSpot, b: LifeSpot): boolean {
  const na = normalizeFoodName(a.name);
  const nb = normalizeFoodName(b.name);
  if (na.length < 2 || nb.length < 2) return false;
  if (!na.includes(nb) && !nb.includes(na)) return false;
  return calculateHaversineDistance(a.lat, a.lng, b.lat, b.lng) <= FOOD_SAME_PLACE_KM;
}

// /food, /api/food-spots, buildLifeSpotCorpus() 3곳이 각자 getFoodList() + looksLikeCafe 필터 +
// mapTourismToFoodSpot을 개별 구현하면(R1 이전까지 실제로 그랬음) 이번에 추가되는 카카오 병합
// 로직까지 3곳에 따로 넣을 경우 어긋날 위험이 크다(buildLifeSpotCorpus()의 기존 경고와 같은
// 종류) — 그래서 병합 결과를 여기 한 곳에서 만들어 3곳 모두 이 함수를 쓰게 한다.
export async function buildFoodSpots(): Promise<LifeSpot[]> {
  const [tourismResult, kakaoResult] = await Promise.allSettled([getFoodList(), getKakaoRestaurants()]);

  const tourismFood =
    tourismResult.status === "fulfilled"
      ? tourismResult.value.filter(hasValidCoords).filter((item) => !looksLikeCafe(item.title)).map(mapTourismToFoodSpot)
      : [];

  // 카카오 FD6 응답에도 디저트카페/베이커리가 섞여 나온다 — 관광공사 응답에 이미 쓰는 것과
  // 동일한 looksLikeCafe 필터를 그대로 적용해 두 소스 간 필터 기준이 어긋나지 않게 한다.
  const kakaoFoodRaw =
    kakaoResult.status === "fulfilled" ? kakaoResult.value.filter((s) => !looksLikeCafe(s.name)) : [];

  // 관광공사 쪽을 우선 채택한다(overview 등 서술형 필드가 있어 정보가 더 풍부) — 카카오 FD6
  // 결과 중 관광공사와 같은 가게로 판정되는 항목만 제외한다.
  const kakaoFood = kakaoFoodRaw.filter((k) => !tourismFood.some((t) => looksSameFoodPlace(t, k)));

  return [...tourismFood, ...kakaoFood];
}

// /api/ai/curate가 클라이언트 제공 lifeSpots(id/필드)를 그대로 신뢰하지 않고 서버가 직접 조회한
// 코퍼스와 대조하기 위한 함수(2026-07-28, P3 항목 1). /api/life-spots, /api/food-spots,
// /api/stay-spots 3개 라우트와 완전히 동일한 조회·필터·매핑 로직을 여기 한 곳에 모아 공유한다 —
// 다르게 구현하면 "실제 클라이언트가 받을 수 있었던 id 집합"과 검증 코퍼스가 어긋나서, 정상 id가
// 부당하게 걸러지거나 반대로 필터를 우회한 id가 통과하는 사고가 날 수 있다.
export async function buildLifeSpotCorpus(): Promise<LifeSpot[]> {
  const [attractionResult, foodSpots, stayResult] = await Promise.allSettled([
    getAttractionList(),
    buildFoodSpots(),
    getStayList(),
  ]);

  const attractions =
    attractionResult.status === "fulfilled"
      ? attractionResult.value.filter(hasValidCoords).map(mapTourismToLifeSpot)
      : [];

  // R1(2026-08-13): 관광공사 단독 조회 대신 buildFoodSpots()(관광공사+카카오 FD6 병합, dedupe
  // 포함)를 그대로 쓴다 — /api/food-spots, /food 페이지와 동일한 함수라 결과가 항상 일치한다.
  const food = foodSpots.status === "fulfilled" ? foodSpots.value : [];

  const stay =
    stayResult.status === "fulfilled" ? stayResult.value.filter(hasValidCoords).map(mapTourismToStaySpot) : [];

  return [...attractions, ...food, ...stay];
}

// ── 위치기반 라이프스팟 후보 (옵션 A, 2026-08-05) ────────────────────────────
//
// buildLifeSpotCorpus는 "강릉 전역 상위 30+30건"이라 워크스팟이 어디든 후보가 항상 같고,
// 외곽 워크스팟을 고르면 동선이 길어진다. 여기서는 실제로 채택될 확률이 높은 워크스팟 후보
// 좌표를 기준으로 관광공사 위치기반 API(locationBasedList2)를 호출해 반경 내 후보를 더 확보한다.
// 이 결과는 지역 기반 후보를 "대체"하지 않고 union한다 — 위치기반 호출이 전부 실패하면
// 라이프스팟이 0건이 되어 validateRoute의 "식당 누락"으로 재시도 3회를 낭비하기 때문이다
// (근거: 요구사항 R2-2).
//
// 호출 상한: NEARBY_REF_COUNT(1) × contentTypeId 2종 = 요청당 최대 2회. refs를 몇 개 넘기든
// 이 함수 안에서 잘라내 상한을 코드로 보장한다.
//
// 원래 R2-3은 3(후보 다양성 우선)으로 확정했으나, QA 실측(2026-08-05, n=10 페어링 측정)에서
// 3을 쓰면 랭킹 2·3위 워크스팟 반경 후보가 라이프스팟 랭킹 상위권을 밀어내 총 이동거리가
// 병합 전보다 +151m(2.9%) 유의하게 길어짐(10/10 동일 방향)을 확인. 1로 줄이면 병합 전과
// 거리가 완전히 동일해지고(교체가 아니라 위치기반 결과가 안 쓰이는 게 아니라 랭킹 1위 반경만
// 반영되어 balanceLifeSpots 정렬과 어긋나지 않기 때문) 호출 수도 6→2회로 줄어 관광공사 API
// 일일 호출 한도(미확인) 리스크도 낮아짐 — 사용자가 다양성보다 동선 품질/API 절약을 선택.
const NEARBY_REF_COUNT = 1;
const NEARBY_RADIUS_M = "3000";
const ATTRACTION_TYPE = "12";
const FOOD_TYPE = "39";

// TourismApiItem에 contenttypeid가 없어 응답만으로 카테고리를 구분할 수 없으므로
// 타입별로 나눠 호출하고, 어떤 타입으로 요청했는지를 기준으로 매핑 함수를 고른다.
const NEARBY_CONTENT_TYPES = [ATTRACTION_TYPE, FOOD_TYPE] as const;

// 관광공사 서비스분류코드(cat3) 중 "카페·전통찻집". 음식점(39) 응답에는 카페·디저트가 섞여 오는데,
// 이름 키워드(looksLikeCafe)만으로는 이름에 카페/커피가 없는 곳을 못 거른다 — QA 실측에서
// `스타벅스 강릉강문해변점`·`롱블랙`·`도깨비젤라또`·`툇마루`·`허스크밀`이 식당 후보로 새어
// 실제 식당(횟집·순두부 등)을 후보에서 밀어냈고, 동선 평균 거리가 오히려 늘었다(2026-08-05 FIX 1).
//
// 반경 3km 위치기반 조회는 워크스팟(=대부분 카페) 주변을 훑기 때문에 지역 기반 조회보다 카페
// 밀도가 훨씬 높아 이 결함이 이 경로에서만 발현된다. 그래서 공용 상수인 `CAFE_KEYWORDS`
// (lib/utils.ts — /api/food-spots·/food 페이지도 공유)를 넓히는 대신, 관광공사가 직접 부여한
// 분류 코드를 이 경로에서만 추가로 본다. 실측(고유 후보 77건): 이름 키워드 11건 → cat3 병용 19건,
// 이름으로 못 잡던 8건(스타벅스·롱블랙·툇마루·허스크밀·에펠루아·초당맷돌젤라또·쎄라비·돌체테리아) 추가 제외.
const CAFE_CAT3 = "A05020900";

function isCafeLikeFood(item: TourismApiItem): boolean {
  return item.cat3 === CAFE_CAT3 || looksLikeCafe(item.title);
}

export async function buildNearbyLifeSpotCorpus(refs: { lat: number; lng: number }[]): Promise<LifeSpot[]> {
  const targets = refs.slice(0, NEARBY_REF_COUNT);
  if (targets.length === 0) return [];

  const calls = targets.flatMap((ref) =>
    NEARBY_CONTENT_TYPES.map((contentTypeId) => ({ ref, contentTypeId }))
  );

  // 일부 호출이 실패해도 성공한 결과는 살린다. 전부 실패하면 빈 배열 → 호출부는 기존
  // 지역 기반 후보만으로 그대로 동작한다.
  const results = await Promise.allSettled(
    calls.map(({ ref, contentTypeId }) =>
      getLocationBasedList(ref.lng, ref.lat, NEARBY_RADIUS_M, contentTypeId)
    )
  );

  const byId = new Map<string, LifeSpot>();
  results.forEach((result, i) => {
    if (result.status !== "fulfilled") {
      console.error("[spot-corpus] nearby life spot fetch failed:", result.reason);
      return;
    }
    const { contentTypeId } = calls[i];
    const items = result.value.filter(hasValidCoords);
    // 음식점 응답에는 카페/디저트가 섞여 나온다. 카페는 워크스팟 코퍼스 쪽에서 다루므로
    // 식당 후보에서는 제외한다 (이름 키워드 + cat3 분류 코드 병용, 위 CAFE_CAT3 주석 참고).
    const filtered = contentTypeId === FOOD_TYPE ? items.filter((item) => !isCafeLikeFood(item)) : items;
    filtered.forEach((item) => {
      const spot = contentTypeId === FOOD_TYPE ? mapTourismToFoodSpot(item) : mapTourismToLifeSpot(item);
      if (!byId.has(spot.id)) byId.set(spot.id, spot);
    });
  });

  return [...byId.values()];
}

// ── 이벤트(축제/행사) 라이프스팟 후보 (옵션 B, 2026-08-07) ────────────────────
//
// getEventList()는 좌표가 아니라 지역(areaCode/sigunguCode)+날짜(기본 todayKST()) 기준 조회라
// buildNearbyLifeSpotCorpus처럼 워크스팟 좌표를 인자로 받을 필요가 없다. 실패/0건이면 빈 배열을
// 반환해 기존 buildNearbyLifeSpotCorpus의 폴백 패턴과 동일하게 curateRoute가 중단되지 않는다.
// date 인자(옵션 B 후속, 2026-08-11): 방문일 선택 UI(R9)가 선택한 날짜를 그대로 getEventList에
// 전달한다. 기본값을 주지 않고 getEventList 자체의 기본값(todayKST())에 위임해, 무인자 호출부와
// 동작이 어긋나지 않게 한다.
export async function buildEventLifeSpotCorpus(date?: string): Promise<LifeSpot[]> {
  try {
    const items = await getEventList(undefined, undefined, date);
    return items.filter(hasValidCoords).map(mapEventToLifeSpot);
  } catch (error) {
    console.error("[spot-corpus] event life spot fetch failed:", error);
    return [];
  }
}
