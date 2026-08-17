import { BeachIndex, BeachIndexEntry, LifeSpot } from "@/types";

// 국립해양조사원_해수욕지수 조회(GetFcstBeachApiServicev2, data.go.kr 15142484). 발급기관이
// 한국관광공사(TOURISM_API_KEY)와도, 강릉시 ITS추진과(GANGNEUNG_ITS_API_KEY)와도 다른 별도
// 기관(해양수산부 국립해양조사원)이라 별도 키를 쓴다(요구사항 문서 2절). data.go.kr 계정 단위로
// 같은 인증키 문자열이 재발급되는 패턴이라 실제로는 기존 키와 값이 같을 수 있지만, 환경변수
// 이름 자체는 기존 GANGNEUNG_ITS_API_KEY 라운드와 동일하게 기관별로 분리해 둔다.
const BASE_URL = "https://apis.data.go.kr/1192136/fcstBeachv2";
const SERVICE_KEY = process.env.KHOA_BEACH_API_KEY ?? "";

// data.go.kr 문서상 numOfRows 최대값(요구사항 문서 3절). totalCount가 500(2026-08-17 실호출
// 확인)이라 한 페이지로는 부족하다 — 실제로 pageNo=1&numOfRows=300 결과엔 "주문진해수욕장"이
// 아예 없고 pageNo=2에만 나온다(경포는 반대로 1페이지에만 있음). 페이지네이션 없이 1페이지만
// 읽으면 지점에 따라 매칭이 랜덤하게 빠지는 버그가 생긴다 — 반드시 totalCount만큼 순회한다.
const MAX_ROWS_PER_PAGE = 300;
// totalCount가 미래에 늘어나도(신규 관측 지점 추가) 무한 루프에 빠지지 않도록 안전판을 둔다.
// 현재 500건/300행 기준 2페이지면 충분하지만 여유를 둔다.
const MAX_PAGES = 5;

// getParkInfo/getParkRltm(lib/gn-traffic-api.ts)과 동일하게 빠른 연속 호출 시 HTTP 200 +
// 빈 바디를 돌려주는 실패 모드가 이 API에서도 나타날 가능성을 배제할 수 없다(같은 data.go.kr
// 인프라, 같은 numOfRows/pageNo 파라미터 체계). 같은 재시도 방어를 그대로 적용한다.
const RETRY_DELAYS_MS = [0, 800, 800];

interface KhoaBeachApiItem {
  bbchNm: string;
  predcYmd: string;
  predcNoonSeCd: string;
  maxWvhgt: string;
  avgWtem: string;
  totalIndex: string;
  [key: string]: unknown;
}

interface KhoaApiResponse {
  header?: { resultCode: string; resultMsg: string };
  body?: {
    items?: { item: KhoaBeachApiItem[] | KhoaBeachApiItem } | string;
    totalCount?: number;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchKhoaPageOnce(url: string): Promise<KhoaApiResponse | null> {
  // signal: 이 Next.js 버전은 동일 URL+options의 GET fetch를 같은 렌더 패스 내에서 자동
  // 메모이즈한다(node_modules/next/dist/docs/.../fetch.md "Memoization"). AbortController
  // signal을 넘기는 게 공식 opt-out 방법이다 — 안 하면 재시도가 첫 응답을 재사용해 무의미해진다
  // (lib/gn-traffic-api.ts에서 실측된 동일 버그, 2026-08-16).
  const res = await fetch(url, { cache: "no-store", signal: new AbortController().signal });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text.trim() === "{}") return null;
  try {
    const data = JSON.parse(text) as KhoaApiResponse;
    if (data.header?.resultCode !== "00") return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchKhoaPage(pageNo: number): Promise<{ items: KhoaBeachApiItem[]; totalCount: number }> {
  const url = new URL(`${BASE_URL}/GetFcstBeachApiServicev2`);
  url.searchParams.set("serviceKey", SERVICE_KEY);
  url.searchParams.set("type", "json");
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(MAX_ROWS_PER_PAGE));
  const urlStr = url.toString();

  let data: KhoaApiResponse | null = null;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await sleep(delay);
    try {
      data = await fetchKhoaPageOnce(urlStr);
    } catch (e) {
      console.error(`[khoa-beach-api] GetFcstBeachApiServicev2 page ${pageNo} fetch threw:`, e);
      data = null;
    }
    if (data) break;
  }

  if (!data) {
    console.error(
      `[khoa-beach-api] GetFcstBeachApiServicev2 page ${pageNo} failed after ${RETRY_DELAYS_MS.length} attempts`
    );
    return { items: [], totalCount: 0 };
  }

  const items = data.body?.items;
  const totalCount = data.body?.totalCount ?? 0;
  if (!items || typeof items === "string") return { items: [], totalCount };
  const item = items.item;
  if (!item) return { items: [], totalCount };
  return { items: Array.isArray(item) ? item : [item], totalCount };
}

// placeCode 없이 호출하면 전국 데이터가 온다(2026-08-17 실호출로 확인 — 대천해수욕장 등 강원도
// 외 지점도 함께 응답됨). 강릉 2곳만 필요하지만 이름 정규화 매칭을 위해 전국 응답에서 걸러내는
// 구조를 그대로 쓴다 — placeCode 정확한 값 목록을 API가 별도로 제공하지 않아 지점코드로 좁혀
// 요청하는 것보다 안전하다.
async function fetchAllKhoaBeachItems(): Promise<KhoaBeachApiItem[]> {
  if (!SERVICE_KEY) return [];

  const all: KhoaBeachApiItem[] = [];
  let totalCount = Infinity;
  for (let pageNo = 1; pageNo <= MAX_PAGES && all.length < totalCount; pageNo++) {
    const { items, totalCount: tc } = await fetchKhoaPage(pageNo);
    if (items.length === 0) break; // 실패했거나 더 이상 데이터가 없음
    all.push(...items);
    totalCount = tc || all.length;
  }
  return all;
}

const BEACH_SUFFIXES = ["해수욕장", "해변"];

// "경포해수욕장"→"경포", "안목해변"→"안목" 처럼 접미사를 제거해 핵심 지명만 남긴다(요구사항
// 문서 4절 2~3단계). 이 핵심 지명이 정확히 일치할 때만 매칭한다 — 반경 기반 좌표 매칭은
// 쓰지 않는다(AC8).
function coreBeachName(name: string): string {
  for (const suffix of BEACH_SUFFIXES) {
    if (name.endsWith(suffix)) return name.slice(0, -suffix.length);
  }
  return name;
}

function isBeachAttraction(spot: LifeSpot): boolean {
  return spot.category === "attraction" && (spot.name.includes("해변") || spot.name.includes("해수욕장"));
}

function parseFloatOrNull(v: unknown): number | null {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

const PERIOD_RANK: Record<string, number> = { "오전": 0, "오후": 1, "일": 0 };

function isBeachPeriod(v: string): v is BeachIndexEntry["period"] {
  return v === "오전" || v === "오후" || v === "일";
}

// LifeSpot 배열 중 category === "attraction"이고 이름에 "해변"/"해수욕장"이 포함된 항목에만
// KHOA 해수욕지수를 이름 정규화 매칭(1:1)으로 붙인다. 반경 기반 좌표 매칭은 쓰지 않는다(AC8) —
// 해변이 넓고 인접 지점 간 거리가 가까워(경포~강문~안목이 수 km 이내) 오차 위험이 크다는 게
// 요구사항 문서의 명시적 판단이다.
export async function attachBeachIndex(lifeSpots: LifeSpot[]): Promise<LifeSpot[]> {
  const candidateIds = new Set(lifeSpots.filter(isBeachAttraction).map((s) => s.id));
  if (candidateIds.size === 0) return lifeSpots;

  const rawItems = await fetchAllKhoaBeachItems();

  if (rawItems.length === 0) {
    // API 실패/키 미설정/응답 0건 — 매칭 대상 자체를 못 가져왔다. 해변 후보는 "매칭 시도했지만
    // 실패"인 null로, 비-해변 명소는 건드리지 않는다(undefined 유지). AC6.
    return lifeSpots.map((s) => (candidateIds.has(s.id) ? { ...s, beachIndex: null } : s));
  }

  // bbchNm 핵심 지명별로 그룹화.
  const groups = new Map<string, KhoaBeachApiItem[]>();
  for (const item of rawItems) {
    const core = coreBeachName(item.bbchNm);
    const list = groups.get(core) ?? [];
    list.push(item);
    groups.set(core, list);
  }

  return lifeSpots.map((s) => {
    if (!candidateIds.has(s.id)) return s;

    const matched = groups.get(coreBeachName(s.name));
    if (!matched || matched.length === 0) {
      // 강문/안목처럼 이름은 해변이지만 KHOA 관측 지점 자체가 없는 경우(요구사항 문서 AC2) —
      // 없는 데이터를 있는 것처럼 붙이지 않는다.
      return { ...s, beachIndex: null };
    }

    // 전국 응답이라 동명이인 해수욕장이 존재할 수 있다(실측: "송정해수욕장"이 강릉시(37.78,
    // 128.94)·부산시(35.18, 129.20) 두 곳에 각각 존재, 2026-08-17 확인 — 좌표가 다른데 이름은
    // 똑같이 응답됨). 이름이 정확히 일치해도 서로 다른 좌표 군집이 둘 이상 섞여 있으면 어느
    // 쪽이 이 명소인지 이름만으로는 확정할 수 없다. 좌표로 "가까운 쪽을 추정해서" 고르지 않고
    // (그건 AC8이 금지하는 반경 기반 매칭과 본질이 같다) 안전하게 null로 남긴다 — "없는/불확실한
    // 데이터를 있는 것처럼 붙이지 않는다" 원칙의 연장.
    const distinctCoords = new Set(matched.map((item) => `${item.lat},${item.lot}`));
    if (distinctCoords.size > 1) {
      console.warn(
        `[khoa-beach-api] ambiguous bbchNm match for "${s.name}" (core="${coreBeachName(s.name)}"): ` +
          `${distinctCoords.size} distinct KHOA locations share this name — skipping to avoid mixing them`
      );
      return { ...s, beachIndex: null };
    }

    const entries: BeachIndexEntry[] = matched
      .map((item) => ({
        date: item.predcYmd,
        period: isBeachPeriod(item.predcNoonSeCd) ? item.predcNoonSeCd : ("일" as const),
        totalIndex: item.totalIndex,
        maxWvhgtM: parseFloatOrNull(item.maxWvhgt),
        avgWtemC: parseFloatOrNull(item.avgWtem),
      }))
      .sort((a, b) => (a.date === b.date ? PERIOD_RANK[a.period] - PERIOD_RANK[b.period] : a.date.localeCompare(b.date)));

    const announcedDate = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);

    const beachIndex: BeachIndex = { entries, announcedDate };
    return { ...s, beachIndex };
  });
}
