import { TourismApiItem, EventApiItem } from "@/types";
import { todayKST } from "@/lib/utils";

const KORSERVICE_URL = "https://apis.data.go.kr/B551011/KorService2";
const BARRIER_FREE_URL = "https://apis.data.go.kr/B551011/KorWithService2";
const SERVICE_KEY = process.env.TOURISM_API_KEY ?? "";

interface TourismApiResponse {
  response: {
    body: {
      items: { item: TourismApiItem[] } | string;
      totalCount: number;
      numOfRows: number;
      pageNo: number;
    };
  };
}

async function fetchApi<T>(baseUrl: string, endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${baseUrl}/${endpoint}`);
  url.searchParams.set("serviceKey", SERVICE_KEY);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "GangneungNode");
  url.searchParams.set("_type", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Tourism API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// 공공데이터포털은 일일 트래픽 초과·키 오류 시 HTTP 200에 전혀 다른 에러 봉투
// (OPEN_API_SERVICE_RESPONSE 등)를 실어 주는 경우가 있다. 예전에는 data.response.body를 바로 읽어
// TypeError가 났고, 호출부의 Promise.allSettled/try-catch가 이를 "그냥 결과 없음"과 똑같이 빈
// 배열로 삼켜 버려서 한도 초과를 알아챌 방법이 아예 없었다(코퍼스가 조용히 VERIFIED_SPOTS 24곳으로
// 축소됨). 폴백 동작(빈 배열)은 그대로 두되, 정상 0건과 구분되는 로그를 남긴다(2026-08-05).
function extractItems(data: TourismApiResponse, endpoint = "unknown"): TourismApiItem[] {
  const body = (data as TourismApiResponse | undefined)?.response?.body;
  if (!body) {
    console.error(
      `[tourism-api] unexpected envelope (endpoint=${endpoint}): ${JSON.stringify(data ?? null).slice(0, 300)}`
    );
    return [];
  }
  const items = body.items;
  if (!items || typeof items === "string") return [];
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// ── 국문 관광정보 ──────────────────────────────────────────

export async function getAreaBasedList(areaCode = "32", sigunguCode = "1", contentTypeId?: string) {
  const params: Record<string, string> = {
    areaCode,
    sigunguCode,
    numOfRows: "50",
    pageNo: "1",
  };
  if (contentTypeId) params.contentTypeId = contentTypeId;
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "areaBasedList2", params);
  return extractItems(data, "areaBasedList2");
}

export async function getDetailCommon(contentId: string) {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "detailCommon2", {
    contentId,
  });
  const items = extractItems(data, "detailCommon2");
  return items[0] ?? null;
}

// ── 위치기반 관광정보 ──────────────────────────────────────

// 좌표를 소수점 3자리(약 110m 격자)로 반올림해 URL을 고정한다. 워크스팟 좌표는 소수점
// 10자리까지 들어 있어서 그대로 쓰면 요청마다 URL이 미세하게 달라져 fetchApi의
// revalidate: 3600 캐시가 사실상 한 번도 히트하지 않는다. 호출부마다 어긋나지 않도록
// 격자화는 반드시 이 함수 안에서 한다(2026-08-05, 옵션 A).
function toGridCoord(value: string | number): string {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(3) : String(value);
}

// mapX = 경도(lng), mapY = 위도(lat) — 관광공사 API 규약이며 mapTourismToWorkSpot의
// lat=mapy / lng=mapx 매핑과 동일하다. 순서를 바꾸면 반경 밖 엉뚱한 지역이 반환된다.
export async function getLocationBasedList(
  mapX: string | number,
  mapY: string | number,
  radius = "1000",
  contentTypeId?: string
) {
  const params: Record<string, string> = {
    mapX: toGridCoord(mapX),
    mapY: toGridCoord(mapY),
    radius,
    numOfRows: "20",
    pageNo: "1",
  };
  if (contentTypeId) params.contentTypeId = contentTypeId;
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "locationBasedList2", params);
  return extractItems(data, `locationBasedList2${contentTypeId ? `(${contentTypeId})` : ""}`);
}

// ── 무장애 관광정보 ────────────────────────────────────────

export async function getBarrierFreeList(areaCode = "32", sigunguCode = "1") {
  const data = await fetchApi<TourismApiResponse>(BARRIER_FREE_URL, "areaBasedList2", {
    areaCode,
    sigunguCode,
    numOfRows: "50",
    pageNo: "1",
  });
  return extractItems(data, "KorWithService2/areaBasedList2");
}

export async function getBarrierFreeDetail(contentId: string) {
  const data = await fetchApi<TourismApiResponse>(BARRIER_FREE_URL, "detailWithTour2", {
    contentId,
  });
  const items = extractItems(data, "detailWithTour2");
  return items[0] ?? null;
}

// ── 숙박 (contentTypeId=32) ───────────────────────────────

export async function getStayList(areaCode = "32", sigunguCode = "1") {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "areaBasedList2", {
    areaCode,
    sigunguCode,
    contentTypeId: "32",
    numOfRows: "30",
    pageNo: "1",
  });
  return extractItems(data, "areaBasedList2(stay)");
}

// ── 음식점 (contentTypeId=39) ─────────────────────────────

export async function getFoodList(areaCode = "32", sigunguCode = "1") {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "areaBasedList2", {
    areaCode,
    sigunguCode,
    contentTypeId: "39",
    numOfRows: "30",
    pageNo: "1",
  });
  return extractItems(data, "areaBasedList2(food)");
}

// ── 관광지 (contentTypeId=12) ──────────────────────────────

export async function getAttractionList(areaCode = "32", sigunguCode = "1") {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "areaBasedList2", {
    areaCode,
    sigunguCode,
    contentTypeId: "12",
    numOfRows: "30",
    pageNo: "1",
  });
  return extractItems(data, "areaBasedList2(attraction)");
}

// ── 행사/축제 (contentTypeId=15, searchFestival2) ─────────
// todayKST()는 lib/utils.ts로 이동했다(옵션 B, 2026-08-07) — lib/ai.ts의 event-date 검증도
// 같은 로직이 필요해 공유 위치로 옮기고 여기서는 재사용만 한다.
// date 인자(옵션 B 후속, 2026-08-11): 방문일 선택 UI(R9)가 "오늘/내일/모레" 기준으로 이벤트를
// 조회할 수 있도록 eventStartDate 파라미터를 외부에서 주입 가능하게 열었다. 기본값은 기존과
// 동일한 todayKST()라 무인자 호출부(app/events/page.tsx 등)는 그대로 호환된다.

export async function getEventList(
  areaCode = "32",
  sigunguCode = "1",
  date = todayKST()
): Promise<EventApiItem[]> {
  const params: Record<string, string> = {
    areaCode,
    eventStartDate: date,
    numOfRows: "30",
    pageNo: "1",
  };
  if (sigunguCode) params.sigunguCode = sigunguCode;

  try {
    const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "searchFestival2", params);
    const items = extractItems(data, "searchFestival2") as EventApiItem[];
    if (items.length > 0) return items;
  } catch {}

  // sigunguCode 제거 후 재시도 (강원도 전체에서 조회)
  const fallbackParams: Record<string, string> = {
    areaCode,
    eventStartDate: date,
    numOfRows: "30",
    pageNo: "1",
  };
  const fallback = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "searchFestival2", fallbackParams);
  return extractItems(fallback, "searchFestival2(fallback)") as EventApiItem[];
}

// ── 관광지 집중률 예측 (TatsCnctrRateService) ─────────────

interface CnctrRateItem {
  contentId?: string;
  tatsCd?: string;
  cnctrRate?: string | number;
  visitCo?: string | number;
  [key: string]: unknown;
}

interface CnctrRateResponse {
  response: {
    body: {
      items: { item: CnctrRateItem[] | CnctrRateItem } | string;
      totalCount: number;
    };
  };
}

// contentId → "low" | "medium" | "high" 맵 반환
export async function getCongestionMap(areaCd = "32", signguCd = "1"): Promise<Map<string, "low" | "medium" | "high">> {
  const map = new Map<string, "low" | "medium" | "high">();
  try {
    const url = new URL("https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList");
    url.searchParams.set("serviceKey", SERVICE_KEY);
    url.searchParams.set("MobileOS", "ETC");
    url.searchParams.set("MobileApp", "GangneungNode");
    url.searchParams.set("_type", "json");
    url.searchParams.set("areaCd", areaCd);
    url.searchParams.set("signguCd", signguCd);
    url.searchParams.set("numOfRows", "100");
    url.searchParams.set("pageNo", "1");

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) return map;

    const data: CnctrRateResponse = await res.json();
    const items = data.response?.body?.items;
    if (!items || typeof items === "string") return map;

    const list = Array.isArray(items.item) ? items.item : [items.item];
    list.forEach((item) => {
      const id = item.contentId ?? item.tatsCd;
      if (!id) return;
      const rate = parseFloat(String(item.cnctrRate ?? item.visitCo ?? 0));
      let level: "low" | "medium" | "high";
      if (rate >= 66) level = "high";
      else if (rate >= 33) level = "medium";
      else level = "low";
      map.set(String(id), level);
    });
  } catch {
    // 데이터 미제공 시 빈 맵 반환 → estimateCongestion으로 fallback
  }
  return map;
}
