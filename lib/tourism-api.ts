import { TourismApiItem } from "@/types";

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

function extractItems(data: TourismApiResponse): TourismApiItem[] {
  const items = data.response.body.items;
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
  return extractItems(data);
}

export async function getDetailCommon(contentId: string) {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "detailCommon2", {
    contentId,
  });
  const items = extractItems(data);
  return items[0] ?? null;
}

// ── 위치기반 관광정보 ──────────────────────────────────────

export async function getLocationBasedList(mapX: string, mapY: string, radius = "1000") {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "locationBasedList2", {
    mapX,
    mapY,
    radius,
    numOfRows: "20",
    pageNo: "1",
  });
  return extractItems(data);
}

// ── 무장애 관광정보 ────────────────────────────────────────

export async function getBarrierFreeList(areaCode = "32", sigunguCode = "1") {
  const data = await fetchApi<TourismApiResponse>(BARRIER_FREE_URL, "areaBasedList2", {
    areaCode,
    sigunguCode,
    numOfRows: "50",
    pageNo: "1",
  });
  return extractItems(data);
}

export async function getBarrierFreeDetail(contentId: string) {
  const data = await fetchApi<TourismApiResponse>(BARRIER_FREE_URL, "detailWithTour2", {
    contentId,
  });
  const items = extractItems(data);
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
  return extractItems(data);
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
  return extractItems(data);
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
  return extractItems(data);
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
