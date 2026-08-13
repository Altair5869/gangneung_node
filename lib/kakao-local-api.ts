import { WorkSpot, LifeSpot } from "@/types";

function inferNoise(name: string): WorkSpot["noise"] {
  const t = name.toLowerCase();
  if (t.includes("독서실") || t.includes("스터디") || t.includes("study") || t.includes("도서관")) return "언급됨-조용함";
  if (t.includes("코워킹") || t.includes("공유오피스") || t.includes("coworking")) return "언급됨-조용함";
  if (t.includes("브루어리") || t.includes("brewery") || t.includes("브루") || t.includes("펍")) return "언급됨-시끄러움";
  return "언급없음";
}

interface KakaoCenter {
  x: string;
  y: string;
  radius?: number; // 미지정 시 RADIUS(6000) 사용
}

// 강릉 주요 구역 중심점 (반경 6km씩 커버). CE7(카페)·FD6(음식점) 쿼리가 공통으로 쓰는
// 광역 베이스 center — 카테고리별 전용 추가 center(CAFE_EXTRA_CENTERS/FOOD_EXTRA_CENTERS)와는
// 별개다.
const CENTERS: KakaoCenter[] = [
  { x: "128.8759", y: "37.7519" }, // 강릉 시내/역
  { x: "128.9170", y: "37.7956" }, // 경포대/강문해변
  { x: "128.8218", y: "37.8981" }, // 주문진
  { x: "128.8500", y: "37.8300" }, // 사천
  { x: "129.0500", y: "37.6800" }, // 정동진
];
const RADIUS = 6000;

// 카카오 로컬 카테고리 검색(category.json)은 좌표 1건당 최대 45건(size 15 × page 3)이
// API 자체의 하드 캡이다 — 페이지를 더 넘겨도 그 이상은 반환되지 않는다(2026-08-13 카카오
// 공식 문서/데브톡 확인). 위 5개 광역 center는 반경이 넓어(6km) 카페/음식점 밀도가 높은
// 초당동 일대에서 이 캡에 걸려 특정 가게가 거리순 45위 밖으로 밀려 누락되는 문제가 실측
// 재현됐다 — CE7("초당밀")과 FD6("뉴솔향초당순두부") 둘 다 동일한 원인으로 확인됨
// (developer 실측, 2026-08-13. FD6 쪽은 애초 요구사항 문서 작성 시점엔 5-center만으로
// 충분할 것으로 가정했으나 실제로는 광역 center 3곳 모두에서 미포함 확인 — pm-analyst에
// 별도 보고).
// 좌표(허균허난설헌기념관, 초당동 477 인근)는 공유하되, 반경은 카테고리별 밀도에 맞춰
// 따로 좁힌다 — 하나의 반경으로 합치면 한쪽 카테고리에서 캡을 다시 넘기거나(너무 넓음)
// 타겟이 빠진다(너무 좁음). CE7/FD6는 서로 다른 배열로 관리해 호출량도 섞이지 않는다.
const CHODANG_LANDMARK = { x: "128.9095233279", y: "37.7909274728" };

// CE7(카페) 전용 추가 center. "초당밀"(포남동, 128.9073/37.7871)이 이 반경 안에서
// 거리순 2/3페이지에 포함되는 것을 실측 확인(dist≈460m).
const CAFE_EXTRA_CENTERS: KakaoCenter[] = [
  { x: CHODANG_LANDMARK.x, y: CHODANG_LANDMARK.y, radius: 2000 },
];

// FD6(음식점) 전용 추가 center. CAFE_EXTRA_CENTERS와 좌표만 같고 배열은 별개 —
// getKakaoRestaurants()만 이 배열을 쓰고 getKakaoCafes() 호출량에는 영향을 주지 않는다.
// "뉴솔향초당순두부"가 이 반경(1000)에서 3페이지째에 포함되는 것을 실측 확인(dist≈530m).
// 반경을 1500으로 넓히면 더 가까운 FD6 후보가 45건 창을 다 채워 오히려 빠진다(실측 확인).
const FOOD_EXTRA_CENTERS: KakaoCenter[] = [
  { x: CHODANG_LANDMARK.x, y: CHODANG_LANDMARK.y, radius: 1000 },
];

interface KakaoPlace {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  x: string;
  y: string;
}

interface KakaoLocalResponse {
  documents: KakaoPlace[];
  meta: { is_end: boolean };
}

async function fetchCategoryPage(
  categoryGroupCode: "CE7" | "FD6",
  center: KakaoCenter,
  page: number
): Promise<KakaoPlace[]> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  url.searchParams.set("category_group_code", categoryGroupCode);
  url.searchParams.set("x", center.x);
  url.searchParams.set("y", center.y);
  url.searchParams.set("radius", String(center.radius ?? RADIUS));
  url.searchParams.set("size", "15");
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data: KakaoLocalResponse = await res.json();
  return data.documents;
}

async function fetchAllPagesForCenter(
  categoryGroupCode: "CE7" | "FD6",
  center: KakaoCenter
): Promise<KakaoPlace[]> {
  const pages = await Promise.all([
    fetchCategoryPage(categoryGroupCode, center, 1),
    fetchCategoryPage(categoryGroupCode, center, 2),
    fetchCategoryPage(categoryGroupCode, center, 3),
  ]);
  return pages.flat();
}

async function fetchKakaoCategory(
  categoryGroupCode: "CE7" | "FD6",
  centers: KakaoCenter[]
): Promise<KakaoPlace[]> {
  if (!process.env.KAKAO_REST_API_KEY) return [];

  try {
    const results = await Promise.all(centers.map((c) => fetchAllPagesForCenter(categoryGroupCode, c)));

    // ID 기준 중복 제거 (광역 center와 전용 추가 center가 겹치는 지역을 함께 훑을 수 있음)
    const seen = new Set<string>();
    return results.flat().filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  } catch {
    return [];
  }
}

export async function getKakaoCafes(): Promise<WorkSpot[]> {
  const unique = await fetchKakaoCategory("CE7", [...CENTERS, ...CAFE_EXTRA_CENTERS]);

  return unique.map((p) => ({
    id: `kakao-${p.id}`,
    name: p.place_name,
    category: "cafe" as const,
    address: p.road_address_name || p.address_name,
    lat: parseFloat(p.y),
    lng: parseFloat(p.x),
    wifi: { available: null },
    power: { level: null },
    noise: inferNoise(p.place_name),
    openHours: "정보 미제공",
    tags: ["카카오맵"],
    imageUrl: "",
  }));
}

// R1(2026-08-13): 카카오 음식점(FD6) 조회. getKakaoCafes()와 fetch 로직(fetchKakaoCategory)을
// 공유하되, 결과는 WorkSpot이 아니라 LifeSpot(category: "food")으로 매핑한다 — LifeSpot 타입에는
// wifi/power/noise 필드 자체가 없다. id는 kakao-food- prefix로 관광공사 food-*, 워크스팟 카페
// kakao-* 와 겹치지 않게 한다. description/tags는 카카오 API가 실제로 주는 사실(장소명·주소·좌표)
// 만 쓰고 서술형 문구를 임의로 짓지 않는다(CLAUDE.md 외부 데이터 수집 규칙 3번).
export async function getKakaoRestaurants(): Promise<LifeSpot[]> {
  const unique = await fetchKakaoCategory("FD6", [...CENTERS, ...FOOD_EXTRA_CENTERS]);

  return unique.map((p) => ({
    id: `kakao-food-${p.id}`,
    name: p.place_name,
    spotType: "life" as const,
    category: "food" as const,
    address: p.road_address_name || p.address_name,
    lat: parseFloat(p.y),
    lng: parseFloat(p.x),
    tags: ["카카오맵", "음식점"],
  }));
}
