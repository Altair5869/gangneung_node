import { calculateHaversineDistance } from "@/lib/ai";
import { LifeSpot, ParkingLot } from "@/types";

// 강릉시 교통정보 조회서비스(GNitsTrafficInfoService, data.go.kr 15140011). 발급기관이
// 한국관광공사(TOURISM_API_KEY)와 다른 별도 계정(강릉시 ITS추진과)이라 별도 키를 쓴다
// (요구사항 문서 "지금 당장 사용자가 해야 할 일" 절).
//
// 베이스 URL/오퍼레이션명은 2026-08-16 실호출로 확인했다 — data.go.kr 상세 페이지는 UI 라벨만
// "주차-기본정보"로 보여주고 실제 오퍼레이션명은 어디에도 노출하지 않아서, 요구사항 문서는
// getParkBasicInfo로 추정했지만 실제로는 getParkInfo였다(getParkBasicInfo/getParkBaseInfo 등은
// 전부 NO_OPENAPI_SERVICE_ERROR). 이 파일의 export 함수명은 요구사항 문서·호출부 기준을 그대로
// 유지하고, 실제 오퍼레이션명 차이는 아래 fetchGnApi 호출 인자로만 흡수한다.
const BASE_URL = "http://apis.data.go.kr/4201000/GNitsTrafficInfoService_1.0";
const SERVICE_KEY = process.env.GANGNEUNG_ITS_API_KEY ?? "";

// 반경(km), pm-analyst 문서 제안값 그대로 채택. 실호출 결과 강릉시 전체 주차장이 13곳뿐이라
// (2026-08-16 실측, getParkInfo totalCount=13) 밀도가 낮다 — 반경을 더 넓혀도 매칭 수가 크게
// 늘지 않고, 오히려 "인근"이라 부르기 애매한 먼 주차장까지 붙는 부작용이 커서 1km를 유지한다.
const PARKING_RADIUS_KM = 1;

// getParkInfo 응답 필드. xCrdn=경도, yCrdn=위도(관광공사 mapX/mapY와 반대로 x=경도지만 이름이
// 명시적이라 헷갈릴 여지는 적음 — 그래도 파싱부에 주석으로 재확인해둔다).
interface GnBasicApiItem {
  prkId: string;
  prkName: string;
  prkAddr?: string;
  xCrdn: string;
  yCrdn: string;
  [key: string]: unknown;
}

// getParkRltm 응답 필드. 갱신 시각 필드가 없다 — 실호출로 확인(2026-08-16, 헤더/바디 어디에도
// updateTime류 필드 없음). 그래서 UI에서 "실시간" 대신 완화된 라벨을 쓴다(AC4).
interface GnRltmApiItem {
  prkId: string;
  prkName: string;
  totalLots: string;
  availLots: string;
}

interface GnApiResponse<T> {
  header?: { resultCode: string; resultMsg: string };
  body?: {
    items?: { item: T[] | T } | string;
    totalCount?: number;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 이 API는 빠른 연속 호출(간격 400ms 이하, 동시 호출 포함) 시 HTTP 200에 빈 바디("{}", 2바이트,
// header/body 필드 자체가 없음)를 돌려주는 경우가 실호출로 재현됐다(2026-08-16 — 동시 호출
// 6/6 중 다수 실패, 800ms 이상 간격에서는 6/6 성공). 429/에러 코드 없이 조용히 빈 응답을
// 주기 때문에 lib/tourism-api.ts의 extractItems처럼 한 번 파싱해서 실패면 바로 포기하면
// getParkInfo/getParkRltm을 나란히 호출할 때(attachNearbyParking) 주차 섹션이 랜덤하게
// 빠지는 문제가 생긴다. 최대 2회 재시도(800ms 간격)로 흡수한다 — 그래도 실패하면 진짜
// 장애로 보고 빈 배열 반환(AC5의 "0건/실패해도 카드는 정상 렌더링" 폴백은 그대로 유지).
const RETRY_DELAYS_MS = [0, 800, 800];

async function fetchGnApiOnce<T>(url: string): Promise<GnApiResponse<T> | null> {
  // signal: 이 Next.js 버전은 동일 URL+options의 GET fetch를 같은 렌더 패스 내에서
  // 자동 메모이즈한다(node_modules/next/dist/docs/.../fetch.md "Memoization" — cache
  // 옵션과 무관하게 적용됨, AbortController signal을 넘기는 것만 공식 opt-out 방법이다).
  // 이걸 안 하면 재시도 3번이 전부 첫 번째(실패한) 응답을 그대로 재사용해 재시도가 무의미해진다
  // — 실제로 이 버그로 getParkRltm 재시도가 항상 실패하는 것을 실측했다(2026-08-16).
  const res = await fetch(url, { cache: "no-store", signal: new AbortController().signal });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text.trim() === "{}") return null; // 실측된 간헐적 빈 바디
  try {
    const data = JSON.parse(text) as GnApiResponse<T>;
    if (data.header?.resultCode !== "00") return null;
    return data;
  } catch {
    return null;
  }
}

// 공공데이터포털 표준 실패 봉투(OPEN_API_SERVICE_RESPONSE 등, lib/tourism-api.ts의
// extractItems와 동일한 배경)까지 포함해 예상 밖 응답이면 빈 배열로 흡수한다. 호출부
// (attachNearbyParking)는 이 빈 배열을 "매칭 불가"로 취급하고, MapLifeSpotCard는 이를
// 다시 정직한 폴백 문구로 렌더링한다(AC5).
//
// next.js fetch 캐시(revalidate)는 여기서 쓰지 않는다 — 재시도 시 같은 URL을 여러 번
// 호출해야 하는데 프레임워크 캐시가 끼면 실패 응답이 캐시돼 재시도 의미가 없어진다.
// 대신 상위 함수 자체를 짧게(요청 단위) 호출하고, 페이지가 이미 force-dynamic이라
// ISR 캐시에 의존하지 않는 구조와도 맞는다(app/map/page.tsx).
async function fetchGnApi<T>(operation: string): Promise<T[]> {
  if (!SERVICE_KEY) return [];

  const url = new URL(`${BASE_URL}/${operation}`);
  url.searchParams.set("serviceKey", SERVICE_KEY);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("type", "json");
  const urlStr = url.toString();

  let data: GnApiResponse<T> | null = null;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await sleep(delay);
    try {
      data = await fetchGnApiOnce<T>(urlStr);
    } catch (e) {
      console.error(`[gn-traffic-api] ${operation} fetch threw:`, e);
      data = null;
    }
    if (data) break;
  }

  if (!data) {
    console.error(`[gn-traffic-api] ${operation} failed after ${RETRY_DELAYS_MS.length} attempts (empty/invalid envelope)`);
    return [];
  }

  const items = data.body?.items;
  if (!items || typeof items === "string") return [];
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// 주차 기본정보(정적: 이름/주소/좌표/운영시간).
export async function getParkBasicInfo(): Promise<GnBasicApiItem[]> {
  return fetchGnApi<GnBasicApiItem>("getParkInfo");
}

// 주차 실시간정보(동적: 잔여면수). "실시간"을 표방하는 오퍼레이션명이지만, 이 값 자체가
// API 원본에서 몇 초/몇 분 주기로 갱신되는지는 확인되지 않았다(AC1 c, 응답에 갱신 시각
// 필드 자체가 없음). 그래서 UI 라벨도 "실시간"이 아니라 완화된 표현("최근 확인된 주차
// 현황")을 쓴다.
export async function getParkRltm(): Promise<GnRltmApiItem[]> {
  return fetchGnApi<GnRltmApiItem>("getParkRltm");
}

function parseIntOrNull(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

// LifeSpot 배열 중 category === "attraction"인 항목에 반경 내 주차장을 매칭해 붙인다.
// calculateHaversineDistance(lib/ai.ts)를 재사용한다 — Math.hypot로 직접 계산하지 않는다
// (gangneung-dev-guide 스킬, 위경도 유클리드 거리 왜곡 문제).
export async function attachNearbyParking(lifeSpots: LifeSpot[]): Promise<LifeSpot[]> {
  const hasAttraction = lifeSpots.some((s) => s.category === "attraction");
  if (!hasAttraction) return lifeSpots;

  // Promise.all로 동시에 쏘지 않는다 — 동시 호출이 위 "빈 바디" 실패 모드를 더 자주
  // 유발하는 것을 실측으로 확인했다(2026-08-16, 동시 호출 시 둘 중 하나가 빈 바디로
  // 응답하는 비율이 순차 호출보다 뚜렷이 높음). 순서대로 기다려 호출한다.
  const basicItems = await getParkBasicInfo();
  const rltmItems = await getParkRltm();

  if (basicItems.length === 0) {
    // 좌표 정보(getParkInfo) 자체를 못 가져오면 매칭이 불가능하다 — attraction 카테고리에
    // 빈 배열을 채워 MapLifeSpotCard가 "인근 주차 정보가 연동되지 않았어요" 폴백을 그리게
    // 한다(AC5, API 실패/키 미설정/0건이어도 명소 카드 자체는 정상 렌더링).
    return lifeSpots.map((s) => (s.category === "attraction" ? { ...s, parking: [] } : s));
  }

  const rltmById = new Map(rltmItems.map((r) => [r.prkId, r]));

  const lots = basicItems
    .map((b) => {
      // xCrdn=경도, yCrdn=위도 (실호출로 확인, 2026-08-16). 파싱 실패 시 매칭 대상에서 제외.
      const lat = parseFloat(b.yCrdn);
      const lng = parseFloat(b.xCrdn);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const rltm = rltmById.get(b.prkId);
      return {
        id: b.prkId,
        name: b.prkName,
        lat,
        lng,
        totalLots: rltm ? parseIntOrNull(rltm.totalLots) : null,
        availLots: rltm ? parseIntOrNull(rltm.availLots) : null,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  return lifeSpots.map((s) => {
    if (s.category !== "attraction") return s;

    const nearby: ParkingLot[] = lots
      .map((lot) => ({
        id: lot.id,
        name: lot.name,
        totalLots: lot.totalLots,
        availLots: lot.availLots,
        distanceKm: calculateHaversineDistance(s.lat, s.lng, lot.lat, lot.lng),
      }))
      .filter((lot) => lot.distanceKm <= PARKING_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return { ...s, parking: nearby };
  });
}
