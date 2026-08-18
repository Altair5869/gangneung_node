import { TourismApiItem, EventApiItem } from "@/types";
import { todayKST } from "@/lib/utils";

const KORSERVICE_URL = "https://apis.data.go.kr/B551011/KorService2";
const BARRIER_FREE_URL = "https://apis.data.go.kr/B551011/KorWithService2";
const SERVICE_KEY = process.env.TOURISM_API_KEY ?? "";

// T 기본값은 TourismApiItem — 기존 호출부(fetchApi<TourismApiResponse>(...))는 전부 타입 인자를
// 명시하지 않으므로 이 기본값을 그대로 물려받아 변경 없이 동작한다. detailIntro2/detailInfo2처럼
// item 스키마가 다른 응답(아래 DetailIntroItem/DetailInfoItem)을 받을 때만 T를 명시적으로 지정한다.
interface TourismApiResponse<T = TourismApiItem> {
  response: {
    body: {
      items: { item: T[] } | string;
      totalCount: number;
      numOfRows: number;
      pageNo: number;
    };
  };
}

// 전역 기본값(1시간)은 목록/이벤트 API가 공유한다. 하루 단위로 늦춰도 되는 호출(운영시간/입장료 등
// 정적에 가까운 정보)만 fetchApi 4번째 인자로 override한다 — 기본값 자체는 건드리지 않는다
// (요구사항 문서 8절).
const DEFAULT_REVALIDATE_SECONDS = 3600;
const DAY_REVALIDATE_SECONDS = 86400;

async function fetchApi<T>(
  baseUrl: string,
  endpoint: string,
  params: Record<string, string>,
  revalidateSeconds: number = DEFAULT_REVALIDATE_SECONDS
): Promise<T> {
  const url = new URL(`${baseUrl}/${endpoint}`);
  url.searchParams.set("serviceKey", SERVICE_KEY);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "GangneungNode");
  url.searchParams.set("_type", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { next: { revalidate: revalidateSeconds } });
  if (!res.ok) throw new Error(`Tourism API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// 공공데이터포털은 일일 트래픽 초과·키 오류 시 HTTP 200에 전혀 다른 에러 봉투
// (OPEN_API_SERVICE_RESPONSE 등)를 실어 주는 경우가 있다. 예전에는 data.response.body를 바로 읽어
// TypeError가 났고, 호출부의 Promise.allSettled/try-catch가 이를 "그냥 결과 없음"과 똑같이 빈
// 배열로 삼켜 버려서 한도 초과를 알아챌 방법이 아예 없었다(코퍼스가 조용히 VERIFIED_SPOTS 24곳으로
// 축소됨). 폴백 동작(빈 배열)은 그대로 두되, 정상 0건과 구분되는 로그를 남긴다(2026-08-05).
function extractItems<T = TourismApiItem>(data: TourismApiResponse<T>, endpoint = "unknown"): T[] {
  const body = (data as TourismApiResponse<T> | undefined)?.response?.body;
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

// 지역 필터 파라미터: areaCode/sigunguCode(레거시 지역코드)는 오죽헌(129784)·아르떼뮤지엄
// 강릉(2804197) 등 실제 존재하는 강릉 콘텐츠를 응답에서 누락시킨다(실측: contentTypeId=14
// 기준 11건 vs lDongRegnCd/lDongSignguCd 기준 32건). 한국관광공사 TourAPI(KorService2 계열)가
// 법정동 코드(lDongRegnCd=51 강원/lDongSignguCd=150 강릉)를 정식 지원함을 라이브 API 호출로
// 확인했다(요구사항 문서 1절). 매개변수명(areaCode/sigunguCode)은 기존 호출부 호환을 위해
// 유지하고, 실제로 API에 보내는 쿼리 파라미터 키만 lDongRegnCd/lDongSignguCd로 교체한다.
export async function getAreaBasedList(
  areaCode = "51",
  sigunguCode = "150",
  contentTypeId?: string,
  numOfRows = "50"
) {
  const params: Record<string, string> = {
    lDongRegnCd: areaCode,
    lDongSignguCd: sigunguCode,
    numOfRows,
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

// detailIntro2 응답 아이템. contentTypeId=12(관광지)와 14(문화시설)가 서로 다른 필드명을 쓴다
// (usetime/usetimeculture 등) — 정규화는 호출부(lib/operating-info.ts)가 담당하고 여기서는
// 원본 필드를 그대로 옮긴다. opendate/expguide는 실호출로 항상 빈 값임을 확인했지만(요구사항
// 문서 1-4절) 스키마 자체에는 존재하므로 타입에 남겨둔다.
export interface DetailIntroItem {
  contentid?: string;
  usetime?: string;        // 이용시간 (contentTypeId=12)
  restdate?: string;        // 쉬는날 (contentTypeId=12)
  usetimeculture?: string;  // 이용시간 (contentTypeId=14)
  restdateculture?: string; // 쉬는날 (contentTypeId=14)
  usefee?: string;          // 이용요금 (contentTypeId=14 응답에만 포함, 12는 스키마에 없음)
  opendate?: string;
  expguide?: string;
  [key: string]: unknown;
}

// detailInfo2 응답 아이템. "입장료" 하나만 보려고 불러도 화장실 등 다른 항목이 같이 온다
// (요구사항 문서 1-3절) — infoname/infotext 쌍의 반복 리스트를 그대로 반환한다.
export interface DetailInfoItem {
  infoname?: string;
  infotext?: string;
  [key: string]: unknown;
}

// detailIntro2: contentId + contentTypeId 둘 다 필수(실호출로 확인, contentTypeId 생략 시
// NO_MANDATORY_REQUEST_PARAMETERS_ERROR1 — 요구사항 문서 1-1절). getDetailCommon과 달리
// 인자 2개를 받는다. 운영시간/입장료는 정적에 가까운 정보라 하루 단위로 캐시한다(8절).
export async function getDetailIntro(contentId: string, contentTypeId: string): Promise<DetailIntroItem | null> {
  const data = await fetchApi<TourismApiResponse<DetailIntroItem>>(
    KORSERVICE_URL,
    "detailIntro2",
    { contentId, contentTypeId },
    DAY_REVALIDATE_SECONDS
  );
  const items = extractItems<DetailIntroItem>(data, "detailIntro2");
  return items[0] ?? null;
}

// detailInfo2: contentTypeId=12(관광지)의 입장료 확보 전용(요구사항 문서 1-3절). detailIntro2와
// 별도 엔드포인트다 — 항목 여러 개(화장실 등)가 섞여 오므로 반복 리스트를 그대로 반환하고,
// 호출부(lib/operating-info.ts)가 infoname === "입장료" 항목만 골라 쓴다.
export async function getDetailInfo(contentId: string, contentTypeId: string): Promise<DetailInfoItem[]> {
  const data = await fetchApi<TourismApiResponse<DetailInfoItem>>(
    KORSERVICE_URL,
    "detailInfo2",
    { contentId, contentTypeId },
    DAY_REVALIDATE_SECONDS
  );
  return extractItems<DetailInfoItem>(data, "detailInfo2");
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

export async function getBarrierFreeList(areaCode = "51", sigunguCode = "150") {
  const data = await fetchApi<TourismApiResponse>(BARRIER_FREE_URL, "areaBasedList2", {
    lDongRegnCd: areaCode,
    lDongSignguCd: sigunguCode,
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

export async function getStayList(areaCode = "51", sigunguCode = "150") {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "areaBasedList2", {
    lDongRegnCd: areaCode,
    lDongSignguCd: sigunguCode,
    contentTypeId: "32",
    numOfRows: "30",
    pageNo: "1",
  });
  return extractItems(data, "areaBasedList2(stay)");
}

// ── 음식점 (contentTypeId=39) ─────────────────────────────

export async function getFoodList(areaCode = "51", sigunguCode = "150") {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "areaBasedList2", {
    lDongRegnCd: areaCode,
    lDongSignguCd: sigunguCode,
    contentTypeId: "39",
    numOfRows: "30",
    pageNo: "1",
  });
  return extractItems(data, "areaBasedList2(food)");
}

// ── 관광지 (contentTypeId=12) ──────────────────────────────

export async function getAttractionList(areaCode = "51", sigunguCode = "150") {
  const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "areaBasedList2", {
    lDongRegnCd: areaCode,
    lDongSignguCd: sigunguCode,
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
  areaCode = "51",
  sigunguCode = "150",
  date = todayKST()
): Promise<EventApiItem[]> {
  const params: Record<string, string> = {
    lDongRegnCd: areaCode,
    eventStartDate: date,
    numOfRows: "30",
    pageNo: "1",
  };
  if (sigunguCode) params.lDongSignguCd = sigunguCode;

  try {
    const data = await fetchApi<TourismApiResponse>(KORSERVICE_URL, "searchFestival2", params);
    const items = extractItems(data, "searchFestival2") as EventApiItem[];
    if (items.length > 0) return items;
  } catch {}

  // lDongSignguCd 제거 후 재시도 (강원도 전체에서 조회)
  const fallbackParams: Record<string, string> = {
    lDongRegnCd: areaCode,
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
