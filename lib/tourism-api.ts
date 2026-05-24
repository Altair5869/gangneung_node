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

// ── 관광 빅데이터 (혼잡도) ────────────────────────────────

interface CongestionItem {
  contentid: string;
  title: string;
  congestionLevel: string;
  congestionTime: string;
}

interface CongestionResponse {
  response: {
    body: {
      items: { item: CongestionItem[] } | string;
    };
  };
}

export async function getCongestionData(areaCode = "32") {
  try {
    const data = await fetchApi<CongestionResponse>(
      "https://apis.data.go.kr/B551011/DataLabService",
      "areaBasedCongestion",
      { areaCode, numOfRows: "30", pageNo: "1" }
    );
    const items = data.response.body.items;
    if (!items || typeof items === "string") return [];
    return Array.isArray(items.item) ? items.item : [items.item];
  } catch {
    return [];
  }
}
