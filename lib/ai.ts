import Anthropic from "@anthropic-ai/sdk";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import {
  WorkSpot,
  LifeSpot,
  RouteStop,
  CurationRequest,
  CurationRoute,
  RouteCheck,
  RouteVerification,
  SpotEvidence,
  isLifeSpot,
} from "@/types";
import { embed, cosineSimilarity } from "@/lib/embeddings";
import { queryTopK } from "@/lib/vector-store";
import { isBarrierFree, wifiLabel, powerLabel, noiseLabel, todayKST } from "@/lib/utils";
import { VERIFIED_SPOTS } from "@/lib/verified-spots";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RECOMMEND_TOOL: Anthropic.Tool = {
  name: "recommend_route",
  description: "사용자 업무 스타일에 맞는 워크-라이프 동선을 추천합니다.",
  input_schema: {
    type: "object" as const,
    properties: {
      workSpotId: {
        type: "string",
        description: "집중 업무를 위한 워크스팟 id 정확히 1개. 업무 시간 내내 이 장소 한 곳에만 머무르고 중간에 다른 워크스팟으로 옮기지 않음. 제공된 워크스팟 목록의 id 값 그대로 사용.",
      },
      lifeSpotIds: {
        type: "array",
        items: { type: "string" },
        description: "관광지/휴식 1~2개 + 식당 정확히 1개를 합쳐 총 2~3개. 제공된 관광지/식당 목록의 id 값 그대로 사용.",
      },
      order: {
        type: "array",
        items: { type: "string" },
        description: "workSpotId와 lifeSpotIds에 고른 모든 id를 실제 방문 순서대로 나열 (누락 없이 전부 포함).",
      },
      summary: {
        type: "string",
        description: "전체 동선을 아우르는 한 줄 소개 (한국어, 1문장). 특정 장소의 방문 순서나 시간대를 언급하지 말 것.",
      },
      stopNotes: {
        type: "array",
        items: { type: "string" },
        description: "order 배열과 정확히 같은 개수·같은 순서로, 각 장소에서 할 일을 한 문장씩 설명 (한국어). stopNotes[0]은 반드시 order[0] 장소에 대한 설명이어야 하고, stopNotes[1]은 order[1]에 대한 설명이어야 함 — 순서를 절대 바꾸지 말 것. 사용자가 시작 시간을 알려주지 않았다면 '아침', '오전' 같은 특정 시간대를 언급하지 말 것.",
      },
      tips: {
        type: "array",
        items: { type: "string" },
        description: "워케이션 실용 팁 2~3개 (한국어). 실제 이동 거리나 소요 시간에 대한 구체적인 수치(예: 'OOOm 이내', '도보 O분')는 정확히 알 수 없으므로 언급하지 말 것 — wifi/콘센트/소음/무장애처럼 제공된 데이터에 있는 사실만 근거로 삼을 것.",
      },
    },
    required: ["workSpotId", "lifeSpotIds", "order", "summary", "stopNotes", "tips"],
  },
};

// 검증 가능한(validateRoute가 실제로 체크하는) preference 3개. "뷰 좋은 곳"/"카페인 충전 가능"은
// 구조화된 필드가 없어 필터·검증 어느 쪽에도 없다 (docs/AGENT_DESIGN.md 매핑표 참고).
const CHECKABLE_PREFERENCES = ["조용한 환경", "콘센트 필수", "무장애 접근 가능"] as const;

// 구조화된 필드가 없어 코드로 검증할 수 없는 선호 조건. 검증한 척하지 않고 검증 결과 카드에
// "검사하지 않음(skipped)"으로 정직하게 노출하기 위해서만 사용한다 (docs/AGENT_DESIGN.md 매핑표).
const UNVERIFIABLE_PREFERENCES = ["뷰 좋은 곳", "카페인 충전 가능"] as const;

// 옵션 F(2026-08-06): request.workStyle 4개 값 중 소음/콘센트와 인과관계가 뚜렷한 2개만
// rankCandidates의 congestion 정렬 2차 키로 연결한다("문서 작업 및 기획"/"창의적 작업 및
// 아이디어 발산"은 근거 불명확해 이번 라운드 제외, docs/AGENT_DESIGN.md 1-3절). 여기 문자열
// 리터럴은 app/ai-curator/page.tsx의 WORK_STYLES value와 정확히 일치해야 한다(W2 재발 방지) —
// 어긋나면 매핑이 조용히 빠지고 화면에는 아무 에러도 안 뜬다.
const WORK_STYLE_BOOST_STYLES = new Set(["집중 코딩/개발 작업", "화상 미팅 및 회의"]);

// 콘센트 확인 스팟을 우선(-1), 소음 확정 "언급됨-시끄러움" 스팟을 후순위(+1)로 미루는 2차 정렬
// 점수. pass/fail 게이트가 아니라 congestion 등급 내부 정렬에만 쓴다 — noise는 확정 사실이 아닌
// 신호이고(CLAUDE.md 데이터 규칙 3), workStyle만으로 콘센트 미확인 스팟을 탈락시키면 안 되므로
// (사용자가 "콘센트 필수"를 직접 체크하지 않은 경우) 필터가 아니라 정렬로만 반영한다.
function workStyleRankScore(spot: WorkSpot): number {
  const powerConfirmed = spot.power.level === "충분함" || spot.power.level === "제한적";
  const noisyConfirmed = spot.noise === "언급됨-시끄러움";
  return (powerConfirmed ? -1 : 0) + (noisyConfirmed ? 1 : 0);
}

// 옵션 D-①(2026-08-06): 구조화된 필드가 없어 preFilter/validateRoute로는 검증할 수 없는
// UNVERIFIABLE_PREFERENCES도, 랭킹(임베딩 유사도 검색) 단계에서는 freeText와 동등하게 참고할 수
// 있다 — "검증"이 아니라 "정렬 참고"이므로 이 두 선호를 검증 로직에 편입하는 것과는 다르다.
// freeText가 없어도 이 선호 중 하나만 선택되면 쿼리가 비지 않아야, "뷰 좋은 곳"만 고른 요청도
// 랭킹에 반영된다(요구사항 R1). validateRoute의 unverifiable-preference 판정(skipped)은 이
// 함수와 무관하게 그대로 유지된다.
function buildSearchQuery(request: CurationRequest): string {
  const activeUnverifiable = UNVERIFIABLE_PREFERENCES.filter((p) => request.preferences.includes(p));
  return [request.freeText?.trim(), ...activeUnverifiable].filter((s): s is string => !!s).join(" ");
}

// filterByPreferences의 "5곳 미만이면 전체 무시" 폴백과 curateRoute의 조기 종료 분기가
// 반드시 같은 임계값을 봐야 하므로 상수로 공유한다 (2026-07-27, P2 항목 1).
const MIN_PREFERENCE_MATCHES = 5;

// 폴백 판단(임계값 미달 여부)과 실제 필터링을 분리했다 — curateRoute가 "몇 곳이나 조건을
// 만족하는지"를 폴백 발동 이전에 미리 알아야 조기 종료 여부를 결정할 수 있기 때문이다.
function applyPreferenceFilters(spots: WorkSpot[], request: CurationRequest): WorkSpot[] {
  let filtered = [...spots];

  // validateRoute와 동일한 기준(확정된 "언급됨-시끄러움"만 제외)으로 통일함(2026-07-27).
  // noise는 확정 사실이 아니라 신호(CLAUDE.md 데이터 규칙 3)이므로, "언급없음"(미확인)을
  // 사전 필터 단계에서부터 배제하는 건 근거 없이 후보군을 좁히는 것과 같다.
  if (request.preferences.includes("조용한 환경"))
    filtered = filtered.filter((s) => s.noise !== "언급됨-시끄러움");
  if (request.preferences.includes("콘센트 필수"))
    filtered = filtered.filter((s) => s.power.level === "충분함" || s.power.level === "제한적");
  if (request.preferences.includes("무장애 접근 가능"))
    filtered = filtered.filter((s) => isBarrierFree(s.barrierFree));

  return filtered;
}

function filterByPreferences(spots: WorkSpot[], request: CurationRequest): WorkSpot[] {
  const filtered = applyPreferenceFilters(spots, request);
  return filtered.length >= MIN_PREFERENCE_MATCHES ? filtered : spots;
}

function buildEmbeddingText(spot: RouteStop): string {
  return `${spot.name} ${spot.category} ${spot.tags.join(" ")} ${spot.description ?? ""}`.trim();
}

async function semanticSort<T extends RouteStop>(query: string, spots: T[]): Promise<T[]> {
  if (spots.length === 0) return spots;
  try {
    const [[queryVec], docVecs] = await Promise.all([
      embed([query], "query"),
      embed(spots.map(buildEmbeddingText), "document"),
    ]);
    return spots
      .map((spot, i) => ({ spot, score: cosineSimilarity(queryVec, docVecs[i]) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.spot);
  } catch {
    return spots;
  }
}

// freeText(+ 옵션 D-①: 선택된 UNVERIFIABLE_PREFERENCES를 합성한 검색 쿼리)가 있으면 먼저 사전
// 색인된 Upstash Vector에서 쿼리 1건만 임베딩해 유사도 검색을 시도한다 (문서 재임베딩 없음).
// 색인이 없거나(미설정) 실패하면 기존처럼 후보 전체를 그 자리에서 재임베딩하는 semanticSort로
// 폴백한다 — 매 요청 문서 재임베딩을 없애는 게 이 경로의 목적이다. 두 경로 모두 동일한
// searchQuery를 받아야 Upstash 설정 여부에 따라 결과가 갈리는 회귀가 생기지 않는다.
async function rankCandidates(spots: WorkSpot[], request: CurationRequest): Promise<WorkSpot[]> {
  const searchQuery = buildSearchQuery(request);
  if (searchQuery) {
    const vectorIds = await queryTopK(searchQuery, Math.max(spots.length, 30));
    if (vectorIds) {
      const byId = new Map(spots.map((s) => [s.id, s]));
      const ranked = vectorIds.map((id) => byId.get(id)).filter((s): s is WorkSpot => s !== undefined);
      // queryTopK는 미설정/실패 시에만 null을 반환한다 — 검색은 성공했지만 반환된 id가 현재 요청의
      // 후보(spots)와 하나도 안 겹치면(재색인을 한 번도 안 돌린 빈 인덱스, 코퍼스가 색인 이후 크게
      // 바뀐 경우 등) ranked가 빈 배열이 되는데, 이때는 null이 아니라서 이 분기를 안 타고 그냥
      // rest(원본 순서)만 반환되던 것이 문제였다. 그러면 랭킹이 사실상 무력화됐는데도 프롬프트는
      // "상위 3~5개 안에서 고르라"는 거짓 전제를 계속 강제하게 된다. ranked가 비어 있으면 벡터
      // 검색 결과를 신뢰하지 않고 semanticSort(실시간 재임베딩)로 폴백한다 (2026-07-27, P2 항목 3).
      if (ranked.length === 0) return semanticSort(searchQuery, spots);
      const rankedIds = new Set(ranked.map((s) => s.id));
      const rest = spots.filter((s) => !rankedIds.has(s.id));
      return [...ranked, ...rest];
    }
    return semanticSort(searchQuery, spots);
  }
  // 옵션 F: 검색 쿼리가 없는 이 분기(벡터 랭킹 미개입)에서만 workStyle을 2차 정렬 키로 얹는다.
  // congestion이 항상 1차 키다 — workStyleRankScore는 같은 congestion 등급 내부에서만 순서를
  // 바꾸고, 등급 자체를 건너뛰게 하지 않는다(요구사항 4). 매핑 안 된 workStyle이면 boost가
  // false라 아래는 항상 congestionDiff만으로 정렬돼 기존 동작과 완전히 동일하다(회귀 없음).
  const order: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const boostWorkStyle = WORK_STYLE_BOOST_STYLES.has(request.workStyle);
  return [...spots].sort((a, b) => {
    const congestionDiff = (order[a.congestion ?? "medium"] ?? 1) - (order[b.congestion ?? "medium"] ?? 1);
    if (congestionDiff !== 0 || !boostWorkStyle) return congestionDiff;
    return workStyleRankScore(a) - workStyleRankScore(b);
  });
}

// Claude에게 넘기는 워크스팟 후보를 좁게 유지해야, 이 후보들의 좌표를 기준으로 삼는
// 관광지/식당 지오 필터링(balanceLifeSpots)도 실제로 좁은 권역을 가리키게 된다.
async function preFilter(spots: WorkSpot[], request: CurationRequest): Promise<WorkSpot[]> {
  const filtered = filterByPreferences(spots, request);
  const ranked = await rankCandidates(filtered, request);
  return ranked.slice(0, 12);
}

function buildWorkSpotsContext(spots: WorkSpot[]): string {
  return spots
    .map((s) => {
      const desc = s.description ? ` | 설명:${s.description.slice(0, 80)}` : "";
      const wifiLabel = s.wifi.available === null ? "미확인" : s.wifi.available ? "O" : "X";
      return `id:${s.id} | ${s.name} (${s.category}) | lat:${s.lat.toFixed(4)} lng:${s.lng.toFixed(4)} | 소음:${s.noise === "언급없음" ? "미확인" : s.noise} | WiFi:${wifiLabel} | 콘센트:${s.power.level ?? "미확인"} | 태그:[${s.tags.join(",")}]${desc}`;
    })
    .join("\n");
}

const LIFE_CATEGORY_LABEL: Record<LifeSpot["category"], string> = {
  attraction: "관광지",
  stay: "숙박",
  food: "식당",
  event: "행사/축제",
};

// 옵션 B(2026-08-07): 이벤트 항목에 한해서만 기간(eventStartDate~eventEndDate)을 컨텍스트에
// 추가로 노출한다. LLM이 이 기간을 참고해 오늘 방문 가능한 이벤트를 우선 고르도록 유도하되,
// 실제 강제는 validateRoute의 event-date 코드 검증이 한다 — 여기서는 재질문(self-critique) 없이
// 정보만 보여준다(AI 에이전트 설계 규칙 3).
function buildLifeSpotsContext(spots: LifeSpot[]): string {
  return spots
    .map((s) => {
      const period = s.category === "event" && s.eventStartDate && s.eventEndDate
        ? ` | 기간:${s.eventStartDate}~${s.eventEndDate}`
        : "";
      return `id:${s.id} | ${s.name} (${LIFE_CATEGORY_LABEL[s.category]})${period} | lat:${s.lat.toFixed(4)} lng:${s.lng.toFixed(4)} | 태그:[${s.tags.join(",")}]`;
    })
    .join("\n");
}

// 관광지/식당 후보를 워크스팟 후보 목록과 무관하게 API 순서 그대로 자르면, 실제로는
// 강릉 반대편에 있는 곳이 섞여 들어와 동선 거리가 크게 벌어질 수 있다. 워크스팟 후보들과의
// 최단 거리를 기준으로 가까운 순서로 정렬한 뒤, 카테고리 균형(식당 확보)을 맞춰 자른다.
function balanceLifeSpots(
  spots: LifeSpot[],
  workSpotRefs: { lat: number; lng: number }[],
  limit: number
): LifeSpot[] {
  const distanceToNearest = (spot: LifeSpot): number =>
    workSpotRefs.length === 0
      ? 0
      : Math.min(...workSpotRefs.map((ref) => calculateHaversineDistance(spot.lat, spot.lng, ref.lat, ref.lng)));

  const sorted = [...spots].sort((a, b) => distanceToNearest(a) - distanceToNearest(b));
  const food = sorted.filter((s) => s.category === "food").slice(0, Math.max(3, Math.floor(limit / 3)));
  const rest = sorted.filter((s) => s.category !== "food").slice(0, limit - food.length);
  return [...rest, ...food].sort((a, b) => distanceToNearest(a) - distanceToNearest(b));
}

// 옵션 A(2026-08-05): 워크스팟 후보 좌표 기준 위치기반 API 후보를 지역 기반 후보에 union한다.
// 관광공사 API 호출은 lib/spot-corpus.ts 쪽 책임이라 여기서는 주입받은 함수만 호출한다
// (lib/ai.ts가 외부 API 조회를 직접 하지 않는 기존 구조를 유지하기 위함).
// 실패·0건이면 base(지역 기반 후보)를 그대로 돌려줘 큐레이션이 중단되지 않는다.
type NearbyLifeSpotFetcher = (refs: { lat: number; lng: number }[]) => Promise<LifeSpot[]>;

// 옵션 B(2026-08-07): getEventList()는 좌표가 아니라 지역+오늘 날짜 기준 조회라 NearbyLifeSpotFetcher와
// 달리 인자가 없다. fetchNearbyLifeSpots와 동일한 DI 패턴(lib/ai.ts는 관광공사 API 모듈을 직접
// import하지 않는다)으로 조회 함수만 주입받는다.
type EventLifeSpotFetcher = () => Promise<LifeSpot[]>;

// 같은 장소를 관광공사와 카카오가 서로 다른 id로 반환하는 일이 실제로 있다 —
// `스타벅스 강릉강문해변점`은 라이프스팟 `food-3536360`이면서 워크스팟 `kakao-397693663`이고,
// `롱블랙`은 `food-2891927` ↔ `kakao-506351806`이다(2026-08-05 QA 실측). id 스킴이 달라
// Map 기반 dedupe로는 잡히지 않고, 방치하면 "이 카페에서 일하고 → 같은 카페에서 식사"라는
// 동선이 거리 0km로 validateRoute를 통과할 수 있다.
//
// 좌표만으로 판정하면 안 된다: 실측에서 워크스팟 30m 이내에 있는 위치기반 후보 27건 중 12건이
// 옆 건물의 **정상 식당**이었다(`강릉짬뽕순두부 동화가든 본점`은 카페 `카페동화`와 9m, `주문진불쭈꾸미`는
// `주문진다방`과 15m). 순수 거리 기준으로 자르면 오히려 좋은 후보가 대량으로 날아간다.
// 그래서 "충분히 가깝고(≤50m) + 이름이 서로 포함 관계"인 경우만 동일 장소로 본다.
const SAME_PLACE_KM = 0.05;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s()\-·.,'"]/g, "");
}

function looksSamePlace(spot: LifeSpot, work: WorkSpot): boolean {
  const a = normalizeName(spot.name);
  const b = normalizeName(work.name);
  if (a.length < 2 || b.length < 2) return false;
  if (!a.includes(b) && !b.includes(a)) return false;
  return calculateHaversineDistance(spot.lat, spot.lng, work.lat, work.lng) <= SAME_PLACE_KM;
}

async function extendLifeSpotCandidates(
  base: LifeSpot[],
  refSpots: WorkSpot[],
  knownWorkSpots: WorkSpot[],
  fetchNearby?: NearbyLifeSpotFetcher
): Promise<LifeSpot[]> {
  if (!fetchNearby || refSpots.length === 0) return base;

  let nearby: LifeSpot[];
  try {
    // 랭킹 상위 순서 그대로 넘긴다 — 실제로 몇 곳을 쓸지(상한)는 fetchNearby 구현이 자른다.
    nearby = await fetchNearby(refSpots.map((s) => ({ lat: s.lat, lng: s.lng })));
  } catch (error) {
    console.error("[ai] 위치기반 라이프스팟 확장 실패 — 지역 기반 후보로 폴백:", error);
    return base;
  }

  const byId = new Map(base.map((s) => [s.id, s]));
  for (const spot of nearby) {
    // 숙박 배제 기준은 curateRoute의 nonStayLifeSpots와 동일하게 유지한다.
    if (spot.category === "stay") continue;
    if (byId.has(spot.id)) continue;
    // 워크스팟 코퍼스 전량과 대조한다 — 랭킹 상위 후보만 보면, 지금은 상위가 아니지만 코퍼스에
    // 존재하는 같은 장소가 그대로 식당 후보로 남는다.
    if (knownWorkSpots.some((w) => looksSamePlace(spot, w))) continue;
    byId.set(spot.id, spot);
  }
  return [...byId.values()];
}

export function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface RecommendToolInput {
  workSpotId: string;
  lifeSpotIds: string[];
  order: string[];
  summary: string;
  stopNotes: string[];
  tips: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

// 프로젝트에 zod 등 런타임 스키마 검증 라이브러리가 없으므로(package.json 확인) 수동 타입가드로
// 최소 diff 처리한다(2026-07-28, P3 항목 3, docs/AGENT_DESIGN.md "toolUse.input 런타임 검증" 절 참고).
// stopNotes.length === order.length까지 확인하는 이유: finalizeRoute 이전 단계에서
// `parsed.order.map((id, i) => [id, parsed.stopNotes[i]])`(아래 noteById)가 인덱스로 두 배열을
// 짝짓기 때문에, 길이가 어긋나면 일부 stopNotes가 조용히 버려지거나 undefined가 섞여 들어간다.
function isRecommendToolInput(input: unknown): input is RecommendToolInput {
  if (!input || typeof input !== "object") return false;
  const v = input as Record<string, unknown>;
  return (
    typeof v.workSpotId === "string" &&
    isStringArray(v.lifeSpotIds) &&
    isStringArray(v.order) &&
    typeof v.summary === "string" &&
    isStringArray(v.stopNotes) &&
    isStringArray(v.tips) &&
    v.stopNotes.length === v.order.length
  );
}

async function generateOnce(
  request: CurationRequest,
  workSpots: WorkSpot[],
  lifeSpots: LifeSpot[],
  retryFeedback?: string
): Promise<CurationRoute> {
  const workContext = buildWorkSpotsContext(workSpots);
  const lifeContext = lifeSpots.length > 0
    ? `\n\n[관광지/라이프스팟 (${lifeSpots.length}개)]\n${buildLifeSpotsContext(lifeSpots)}`
    : "";
  const feedbackText = retryFeedback
    ? `\n\n[이전 추천 재검토 필요]\n${retryFeedback}\n위 문제를 피해서 다른 장소로 다시 동선을 구성해주세요.`
    : "";
  // 옵션 B(2026-08-07): 이벤트 후보가 있을 때만 안내 1줄 추가(선택 사항). 실제 강제는
  // validateRoute의 event-date 코드 검증이 하므로, 여기서는 "기간을 참고하라"는 힌트만 준다 —
  // 재질문(self-critique) 없음.
  const eventHintLine = lifeSpots.some((s) => s.category === "event")
    ? "\n관광지/라이프스팟 후보 중 (행사/축제)로 표시된 항목은 '기간' 필드가 오늘 방문 가능한지 참고하세요."
    : "";
  // 옵션 D-①: 정렬 안내 문구 노출 조건을 freeText 단독 체크에서 "합성 검색 쿼리(freeText +
  // 선택된 UNVERIFIABLE_PREFERENCES)가 비어있지 않음"으로 넓힌다 — rankCandidates가 실제로
  // 랭킹 순서를 바꾸는 조건과 일치시켜야, "뷰 좋은 곳"만 선택했을 때도 Claude가 정렬 사실을
  // 알고 상위 후보를 우선하게 된다(freeText 없이 이 선호만 선택하면 아래 quote 줄은 생략).
  const searchQuery = buildSearchQuery(request);
  const freeTextLine = searchQuery
    ? `${request.freeText ? `\n자유 요청사항: "${request.freeText}"` : ""}\n중요: 워크스팟 후보 목록은 이 요청과의 관련도가 높은 순서로 정렬되어 있습니다. 다른 제약 조건(콘센트 등) 위반이 없는 한, 반드시 목록 상위 3~5개 안에서 workSpotId를 고르세요. 하위권 후보는 이 요청과 관련이 적으니 우선순위에서 제외하세요. 자유 요청사항과 관련된 특징(예: 바다뷰)은 후보의 '설명' 필드에 실제로 근거가 있을 때만 언급하고, 근거 없이 지어내지 마세요.`
    : "";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: "당신은 강릉 워케이션 전문 큐레이터입니다. 사용자의 업무 스타일과 선호도를 분석해 업무와 여가가 균형 잡힌 하루 동선을 추천합니다. 반드시 제공된 장소 목록에서만 선택하고, id 값을 정확히 사용하세요.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `[워크스팟 (${workSpots.length}개)]\n${workContext}${lifeContext}`,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: `업무 스타일: ${request.workStyle}\n업무 시간: ${request.duration}시간\n선호 조건: ${request.preferences.length > 0 ? request.preferences.join(", ") : "없음"}${freeTextLine}\n\n워크-라이프 동선을 구성해주세요:\n- 워크스팟 정확히 1곳 (집중 업무. 업무 중간에 다른 워크스팟으로 옮기지 말고 한 곳에 머무를 것)\n- 관광지/휴식 스팟 1~2곳 (업무 사이 휴식·여가. 해변·전망 등 숨 돌릴 수 있는 곳)\n- 식당 1곳 (식사)\n이동 거리를 고려해 가까운 장소끼리 배치하세요.\n주의: 사용자가 시작 시간을 지정하지 않았으므로 특정 시간대(아침/오후 등)를 지어내지 마세요. 정확한 이동 거리·소요 시간 수치도 알 수 없으니 언급하지 마세요. stopNotes는 반드시 order와 같은 순서로 작성하세요.${eventHintLine}${feedbackText}`,
          },
        ],
      },
    ],
    tools: [RECOMMEND_TOOL],
    tool_choice: { type: "tool", name: "recommend_route" },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("AI 응답 오류");

  // tool_choice로 recommend_route 호출 자체는 강제되지만(230줄), Anthropic SDK/모델 버전이 바뀌거나
  // 스키마와 어긋난 응답이 오면 toolUse.input의 "필드 형태"까지는 강제되지 않는다. 예전에는 `as`
  // 단언만 믿고 넘어가서, tips 같은 필드가 비어 있으면 재시도 루프 밖(withDistanceTip)에서 정체불명
  // TypeError로 터졌다. 여기서 명시적으로 검증해 원인이 분명한 에러로 바꾼다(2026-07-28, P3 항목 3).
  if (!isRecommendToolInput(toolUse.input)) {
    throw new Error(
      `AI 응답 스키마 불일치: recommend_route 필수 필드가 없거나 타입이 맞지 않습니다 (${JSON.stringify(toolUse.input)})`
    );
  }
  const parsed = toolUse.input;

  // stopNotes[i]는 order[i]에 대한 설명이라는 전제로 짝지어 Map에 담아 둔다 — 이후 orderedIds가
  // 필터링/보정으로 원래 order와 달라져도, id 기준으로 찾으면 설명문이 절대 다른 장소로 안 붙는다.
  const noteById = new Map(parsed.order.map((id, i) => [id, parsed.stopNotes[i]]));

  // order가 workSpotId/lifeSpotIds에서 고른 id를 빠뜨리거나 순서만 알려주는 용도이므로,
  // 실제 채택 여부는 workSpotId·lifeSpotIds 쪽을 기준으로 삼고 order는 정렬 기준으로만 쓴다.
  const chosenIds = new Set([parsed.workSpotId, ...parsed.lifeSpotIds]);
  const orderedIds = parsed.order.filter((id) => chosenIds.has(id));
  for (const id of chosenIds) {
    if (!orderedIds.includes(id)) orderedIds.push(id);
  }

  const allSpots: RouteStop[] = [...workSpots, ...lifeSpots];
  const selectedSpots = orderedIds
    .map((id) => allSpots.find((s) => s.id === id))
    .filter((s): s is RouteStop => s !== undefined);

  if (selectedSpots.length === 0) throw new Error("추천 장소를 찾을 수 없습니다");

  const description = [parsed.summary, ...orderedIds.map((id) => noteById.get(id)).filter(Boolean)].join(" ");

  return {
    spots: selectedSpots,
    totalDuration: request.duration,
    description,
    tips: parsed.tips,
  };
}

// 2026-07-14 실측 재보정: docs/AGENT_DESIGN.md의 제안치(2h→3km 등)는 실제 강릉 후보 스팟 분포에서
// 무제약 추천도 5.7~6.8km가 정상 범위라 절반 가까이 오탐이 발생함을 확인. 관측 범위의 ~1.5~2배로 상향.
const DISTANCE_THRESHOLD_KM: Record<number, number> = { 2: 8, 4: 10, 6: 13, 8: 16 };

function distanceThresholdFor(duration: number): number {
  const buckets = Object.keys(DISTANCE_THRESHOLD_KM).map(Number);
  const closest = buckets.reduce((a, b) => (Math.abs(b - duration) < Math.abs(a - duration) ? b : a));
  return DISTANCE_THRESHOLD_KM[closest];
}

function totalSequentialDistance(spots: RouteStop[]): number {
  let total = 0;
  for (let i = 0; i < spots.length - 1; i++) {
    total += calculateHaversineDistance(spots[i].lat, spots[i].lng, spots[i + 1].lat, spots[i + 1].lng);
  }
  return total;
}

// reasons는 두 종류로 나뉜다: (1) 사용자가 선택한 preferences(콘센트/무장애/조용한 환경) 위반 —
// curateRoute의 조기 종료 분기가 이미 "조건을 완화했다"고 안내하므로 중복 경고가 필요 없다,
// (2) 그 외 구조적 위반(워크스팟 개수, 식당 누락, 거리 초과) — 조기 종료 분기라도 반드시 알려야 한다.
// 문자열 패턴 매칭(예: "조건 위반" 포함 여부)에 기대지 않고, push하는 시점에 바로 태깅해서
// 두 함수(curateRoute 조기 종료 분기, validateNode)가 각자 필요한 목록을 그대로 쓰게 한다(2026-07-27, QA FIX).
//
// checks는 기존 reasons/structuralReasons와 별개로, "무엇을 검증해서 통과했는가"를 성공 케이스에서도
// 화면에 보여주기 위한 표시용 결과다(옵션 C). 판정 자체는 아래 기존 조건식을 그대로 재사용하며
// 새 판정 기준을 만들지 않는다 — 검증 로직과 표시가 어긋나면 화면이 거짓말을 하게 되기 때문이다.
// congestion은 실데이터와 estimateCongestion 추정치가 섞여 있어(CLAUDE.md 데이터 규칙 5)
// "검증 통과 항목"에 넣으면 추정치가 사실로 승격되므로 의도적으로 제외한다.
function validateRoute(
  route: CurationRoute,
  request: CurationRequest
): { valid: boolean; reasons: string[]; structuralReasons: string[]; checks: RouteCheck[] } {
  const reasons: string[] = [];
  const structuralReasons: string[] = [];
  const pushStructural = (reason: string) => {
    reasons.push(reason);
    structuralReasons.push(reason);
  };
  const pushPreference = (reason: string) => {
    reasons.push(reason);
  };

  const workStops = route.spots.filter((s): s is WorkSpot => !isLifeSpot(s));

  if (workStops.length !== 1) {
    pushStructural(`워크스팟은 정확히 1곳이어야 합니다: 현재 ${workStops.length}곳`);
  }

  const hasFood = route.spots.some((s) => isLifeSpot(s) && s.category === "food");
  if (!hasFood) {
    pushStructural("식당이 동선에 포함되지 않았습니다");
  }

  // power.level은 noise와 달리 전화 확인/방문으로 사실 확인이 가능한 필드(CLAUDE.md 데이터 규칙 1)라
  // "필수" 조건에서는 null(미확인)도 위반으로 판정한다 — 확인 안 된 곳을 "충족"으로 쳐주면 필수 조건의
  // 의미가 약해진다. filterByPreferences도 동일 기준(null 제외)이라 필터-검증 간 정합성은 이미 맞음(2026-07-27 재확인).
  const powerChecked = request.preferences.includes("콘센트 필수");
  let powerViolations = 0;
  if (powerChecked) {
    workStops.forEach((s) => {
      if (s.power.level !== "충분함" && s.power.level !== "제한적") {
        powerViolations++;
        pushPreference(`콘센트 조건 위반: ${s.name}`);
      }
    });
  }

  const barrierChecked = request.preferences.includes("무장애 접근 가능");
  let barrierViolations = 0;
  if (barrierChecked) {
    workStops.forEach((s) => {
      if (!isBarrierFree(s.barrierFree)) {
        barrierViolations++;
        pushPreference(`무장애 조건 위반: ${s.name}`);
      }
    });
  }

  const noiseChecked = request.preferences.includes("조용한 환경");
  let noiseViolations = 0;
  if (noiseChecked) {
    workStops.forEach((s) => {
      if (s.noise === "언급됨-시끄러움") {
        noiseViolations++;
        pushPreference(`조용한 환경 조건 위반: ${s.name}`);
      }
    });
  }

  const threshold = distanceThresholdFor(request.duration);
  const distance = totalSequentialDistance(route.spots);
  if (distance > threshold) {
    pushStructural(`이동 거리 초과: 총 ${distance.toFixed(1)}km (기준 ${threshold}km)`);
  }

  // 옵션 B(2026-08-07): 행사/축제 날짜 검증. 사용자 preference 토글이 아니라 "동선에 이벤트가
  // 포함됐는가"라는 콘텐츠 조건에 좌우되는 항상-활성 구조적 체크(food-included/workspot-count와
  // 동일 분류) — 동선에 이벤트가 없으면 자명하게 통과이고, 있으면 오늘(KST) 날짜가 시작~종료
  // 기간 안인지 코드로 검증한다. eventStartDate/eventEndDate는 관광공사 API가 그대로 제공하는
  // 확정 사실 데이터라(해석·주관 개입 없음) barrierFree와 같은 근거로 pass/fail 게이트로 쓴다
  // (CLAUDE.md 데이터 규칙 4 연장, 방문일 UI가 없으므로 "오늘"을 암묵적 방문일로 취급 — 설계
  // 한계로 이미 인지됨, 버그 아님).
  const eventStops = route.spots.filter(
    (s): s is LifeSpot => isLifeSpot(s) && s.category === "event" && !!s.eventStartDate && !!s.eventEndDate
  );
  const today = todayKST();
  const eventViolations = eventStops.filter(
    (s) => !(s.eventStartDate! <= today && today <= s.eventEndDate!)
  );
  eventViolations.forEach((s) => {
    pushStructural(`행사 기간이 아닙니다: ${s.name} (${s.eventStartDate}~${s.eventEndDate}, 오늘 ${today})`);
  });

  // 각 필드 상태 문구는 반드시 lib/utils의 라벨 헬퍼를 거친다 — 여기서 한국어 상태 문자열을
  // 새로 지어내면 "미확인"이 "없음"으로 둔갑하는 등 데이터 규칙 위반이 UI까지 번진다.
  const perStop = (render: (s: WorkSpot) => string) => workStops.map((s) => `${s.name} · ${render(s)}`).join(", ");
  const SKIPPED_DETAIL = "선호 조건으로 선택하지 않아 검사하지 않았습니다";

  const checks: RouteCheck[] = [
    {
      id: "workspot-count",
      label: "워크스팟 1곳 선정",
      status: workStops.length === 1 ? "pass" : "fail",
      detail: `현재 ${workStops.length}곳`,
    },
    {
      id: "food-included",
      label: "식당 포함",
      status: hasFood ? "pass" : "fail",
      detail: hasFood ? "식당 1곳 이상 포함" : "식당이 동선에 없습니다",
    },
    {
      id: "distance",
      label: "총 이동 거리",
      status: distance <= threshold ? "pass" : "fail",
      detail: `${distance.toFixed(1)} / ${threshold} km · 직선 기준`,
    },
    {
      id: "power",
      label: "콘센트 필수 조건",
      status: !powerChecked ? "skipped" : powerViolations === 0 ? "pass" : "fail",
      detail: powerChecked ? perStop((s) => powerLabel(s.power.level)) : SKIPPED_DETAIL,
    },
    {
      id: "barrier-free",
      label: "무장애 접근 조건",
      status: !barrierChecked ? "skipped" : barrierViolations === 0 ? "pass" : "fail",
      detail: barrierChecked
        ? perStop((s) => (isBarrierFree(s.barrierFree) ? "출입 가능 확인" : "정보 없음"))
        : SKIPPED_DETAIL,
    },
    {
      id: "noise",
      label: "조용한 환경 조건",
      status: !noiseChecked ? "skipped" : noiseViolations === 0 ? "pass" : "fail",
      detail: noiseChecked ? perStop((s) => noiseLabel(s.noise)) : SKIPPED_DETAIL,
    },
    {
      id: "event-date",
      label: "행사 날짜 유효성",
      status: eventViolations.length === 0 ? "pass" : "fail",
      detail:
        eventStops.length === 0
          ? "동선에 포함된 행사/축제가 없습니다"
          : eventStops
              .map((s) => `${s.name} · ${s.eventStartDate}~${s.eventEndDate}${eventViolations.includes(s) ? " (오늘 기간 아님)" : ""}`)
              .join(", "),
    },
  ];

  const activeUnverifiable = UNVERIFIABLE_PREFERENCES.filter((p) => request.preferences.includes(p));
  if (activeUnverifiable.length > 0) {
    checks.push({
      id: "unverifiable-preference",
      label: activeUnverifiable.join(" · "),
      status: "skipped",
      detail: "구조화된 데이터가 없어 자동 검증 대상이 아닙니다 (AI 추천 시 참고만 함)",
    });
  }

  // 옵션 F: rankCandidates가 실제로 workStyle 가중치를 적용한 경우(매핑 대상 스타일 +
  // 검색 쿼리 없음 — rankCandidates의 congestion 정렬 분기 조건과 정확히 동일)에만 이 항목을
  // 추가한다. pass/fail 게이트가 아니므로 항상 "skipped"이며, "확정"/"보장" 단어를 쓰지 않는다.
  const workStyleRankingApplied = WORK_STYLE_BOOST_STYLES.has(request.workStyle) && buildSearchQuery(request) === "";
  if (workStyleRankingApplied) {
    checks.push({
      id: "workstyle-ranking",
      label: `업무 스타일 참고: ${request.workStyle}`,
      status: "skipped",
      detail: "콘센트가 확인된 곳을 우선하고 소음이 시끄럽다고 언급된 곳을 후순위로 정렬에 참고했습니다 (검증 아님)",
    });
  }

  return { valid: reasons.length === 0, reasons, structuralReasons, checks };
}

const MAX_ATTEMPTS = 3;

// Claude는 좌표만 보고 실제 km 단위 거리를 정확히 알 수 없어 tips에 근거 없는 수치를
// 지어낼 수 있다 (예: "500m 이내"). 프롬프트로 언급을 막는 것과 별개로, 실제 이동거리는
// 코드로 계산한 값만 사실로 노출한다.
// 문구 정정(2026-08-05): 이 값은 하버사인(직선) 합계인데 "실제"라고 표기해, 같은 화면에서
// 도로 경로를 그리는 RouteMap(카카오모빌리티)과 서로 다른 거리 개념이 같은 이름으로 노출됐다.
// 도로 거리·이동 시간 반영은 옵션 E 범위이므로 여기서는 표기만 "직선 기준"으로 바로잡는다.
function withDistanceTip(route: CurationRoute): CurationRoute {
  const distance = totalSequentialDistance(route.spots);
  return { ...route, tips: [...route.tips, `총 이동 거리: 약 ${distance.toFixed(1)}km (직선 기준)`] };
}

// 실측 24곳(lib/verified-spots.ts) 판정용 집합. 실측 여부를 "검증됨"으로 오인하게 표시하지 않기
// 위해 UI에서는 별도 배지로만 구분한다.
const VERIFIED_CONTENT_IDS = new Set(
  VERIFIED_SPOTS.map((v) => v.tourismContentId).filter((id): id is string => Boolean(id))
);

// LifeSpot에는 wifi/power/noise/barrierFree 필드 자체가 없으므로 워크스팟만 대상으로 한다.
function buildEvidence(route: CurationRoute): SpotEvidence[] {
  return route.spots
    .filter((s): s is WorkSpot => !isLifeSpot(s))
    .map((s) => ({
      spotId: s.id,
      wifi: wifiLabel(s.wifi.available),
      power: powerLabel(s.power.level),
      noise: noiseLabel(s.noise),
      // barrier-free check(validateRoute)와 동일하게 exit만 기준으로 삼은 요약 — 판정 로직은
      // 건드리지 않는다(옵션 I R2). barrierFreeDetail은 그 판정에 쓰이지 않는 5개 필드 원본을
      // 가공 없이 그대로 실어 결과 화면(RouteVerificationCard)에 추가 정보로만 노출하기 위함이다.
      barrierFree: isBarrierFree(s.barrierFree) ? "출입 가능 확인" : "정보 없음",
      barrierFreeDetail: s.barrierFree,
      measured: Boolean(s.tourismContentId && VERIFIED_CONTENT_IDS.has(s.tourismContentId)),
    }));
}

function buildVerification(route: CurationRoute, request: CurationRequest, attempts: number): RouteVerification {
  const { checks } = validateRoute(route, request);
  return {
    checks,
    distanceKm: Number(totalSequentialDistance(route.spots).toFixed(1)),
    distanceThresholdKm: distanceThresholdFor(request.duration),
    attempts,
    evidence: buildEvidence(route),
  };
}

function formatClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 이동 시간은 실측이 아니라 가정한 평균 속도(도보/차량)로 하버사인 거리를 환산한 추정치다.
// DISTANCE_THRESHOLD_KM처럼 실제 후보 분포를 측정해 보정한 값이 아니므로 "실측"이라고 표기하지 말 것
// (옵션 E, docs/AGENT_DESIGN.md 참고). 직선거리를 쓰기 때문에 실제 도로 이동 시간보다 낮게 나올 수
// 있어, 차량 속도를 시내 평균보다 보수적으로 낮게(25km/h) 잡아 일부 상쇄한다.
const WALK_THRESHOLD_KM = 1;
const WALK_SPEED_KMH = 4;
const DRIVE_SPEED_KMH = 25;
const MIN_TRAVEL_MIN = 5;

function estimateTravelMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const speed = distanceKm < WALK_THRESHOLD_KM ? WALK_SPEED_KMH : DRIVE_SPEED_KMH;
  return Math.max(MIN_TRAVEL_MIN, Math.round((distanceKm / speed) * 60));
}

// 같은 이유로(수치 환각 방지), 시작 시간이 주어졌을 때의 예상 일정도 Claude가 아니라
// 코드가 계산한다. 워크스팟은 요청한 업무 시간만큼, 식당은 1시간, 관광지/휴식은 45분으로 고정 배분.
// 스팟 사이 이동 구간은 하버사인 거리를 estimateTravelMinutes로 환산한 추정치이며(옵션 E),
// 별도 배열 원소로 삽입하고 다음 스팟 시작 시각을 그만큼 뒤로 민다.
function buildSchedule(spots: RouteStop[], request: CurationRequest, startHour: number): string[] {
  let cursor = startHour * 60;
  const result: string[] = [];
  spots.forEach((spot, i) => {
    if (i > 0) {
      const prev = spots[i - 1];
      const distanceKm = calculateHaversineDistance(prev.lat, prev.lng, spot.lat, spot.lng);
      const travelMin = estimateTravelMinutes(distanceKm);
      cursor += travelMin;
      result.push(`이동 약 ${travelMin}분 (${distanceKm.toFixed(1)}km · 추정)`);
    }
    const blockMin = isLifeSpot(spot) ? (spot.category === "food" ? 60 : 45) : request.duration * 60;
    const start = formatClock(cursor);
    cursor += blockMin;
    const end = formatClock(cursor);
    const label = isLifeSpot(spot) ? spot.name : `${spot.name} (업무)`;
    result.push(`${start}~${end} ${label}`);
  });
  return result;
}

// withDistanceTip과 마찬가지로 "추정치를 사실처럼 보이지 않게" 정정하는 문구를 추가한다(옵션 E).
// 일정표(schedule)가 실제로 생성될 때만 의미가 있으므로 startHour가 있을 때만 붙인다.
function withTravelTimeTip(route: CurationRoute): CurationRoute {
  return {
    ...route,
    tips: [
      ...route.tips,
      "일정표의 이동 시간은 도보(4km/h)·차량(25km/h) 평균 속도를 가정한 추정치입니다 — 실제 소요 시간과 다를 수 있습니다.",
    ],
  };
}

// attempts: 실제 생성(Claude 호출) 횟수. 조기 종료 폴백 경로는 1회 생성이므로 1이고,
// LangGraph 경로는 재시도 포함 누적 attempt 값을 그대로 싣는다.
function finalizeRoute(route: CurationRoute, request: CurationRequest, attempts: number): CurationRoute {
  const withDistance = withDistanceTip(route);
  const verified: CurationRoute = {
    ...withDistance,
    verification: buildVerification(withDistance, request, attempts),
  };
  if (request.startHour === undefined) return verified;
  const withTip = withTravelTimeTip(verified);
  return { ...withTip, schedule: buildSchedule(withTip.spots, request, request.startHour) };
}

// Node1(생성)→Node2(코드 기반 검증)→불합격 시 사유를 프롬프트에 실어 재시도(최대 MAX_ATTEMPTS회)
// 구조를 LangGraph StateGraph로 명시화한다. self-critique(LLM에게 "이거 괜찮아?" 재질문)가 아니라
// 불리언/숫자 비교로 검증하는 것은 기존과 동일 — docs/AGENT_DESIGN.md에 설계만 있던 것을 실제로 구현.
const CurationState = Annotation.Root({
  request: Annotation<CurationRequest>(),
  workSpots: Annotation<WorkSpot[]>(),
  lifeSpots: Annotation<LifeSpot[]>(),
  route: Annotation<CurationRoute | null>(),
  valid: Annotation<boolean>(),
  reasons: Annotation<string[]>(),
  attempt: Annotation<number>(),
});

async function generateNode(state: typeof CurationState.State) {
  const feedback = state.reasons.length > 0 ? state.reasons.join("; ") : undefined;
  // 주의: generateOnce가 isRecommendToolInput 검증 실패로 던지는 에러는 여기서 catch하지 않는다.
  // 그 결과 이 예외는 validateNode/routeAfterValidate의 state 기반 재시도 루프를 타지 않고
  // curationGraph.invoke() 자체를 reject시켜 곧바로 route.ts의 바깥쪽 catch(500 curation_failed)로
  // 간다 — LangGraph StateGraph는 노드에 retryPolicy를 별도로 지정하지 않는 한 노드가 던진 예외를
  // 자동으로 재시도하지 않으며(node_modules/@langchain/langgraph 확인), routeAfterValidate의 재시도는
  // "정상적으로 반환된 route가 검증 기준을 통과하지 못했을 때"만 발동하는 별개 메커니즘이기 때문이다.
  // 스키마 검증 실패를 억지로 이 루프에 태우려면(예: route:null을 리턴하고 validateNode/finalizeRoute가
  // null route를 안전하게 처리하도록 고치는 등) 방어 코드가 여러 곳에 더 필요해지는데, tool_choice
  // 강제 + required 스키마 덕분에 실제 발생 확률이 매우 낮은 케이스라 그 복잡도를 들일 가치가 없다고
  // 판단했다. 대신 "정체불명 TypeError"였던 기존 증상을 "원인이 명시된 즉시 실패"로 바꾸는 데
  // 그쳤다(2026-07-28, P3 항목 3 결정 — 근거는 docs/AGENT_DESIGN.md에도 기록).
  const route = await generateOnce(state.request, state.workSpots, state.lifeSpots, feedback);
  return { route, attempt: state.attempt + 1 };
}

function validateNode(state: typeof CurationState.State) {
  const { valid, reasons } = validateRoute(state.route as CurationRoute, state.request);
  return { valid, reasons };
}

function routeAfterValidate(state: typeof CurationState.State): "retry" | "end" {
  if (state.valid) return "end";
  if (state.attempt >= MAX_ATTEMPTS) return "end";
  return "retry";
}

const curationGraph = new StateGraph(CurationState)
  .addNode("generate", generateNode)
  .addNode("validate", validateNode)
  .addEdge(START, "generate")
  .addEdge("generate", "validate")
  .addConditionalEdges("validate", routeAfterValidate, { retry: "generate", end: END })
  .compile();

export async function curateRoute(
  request: CurationRequest,
  availableSpots: WorkSpot[],
  availableLifeSpots: LifeSpot[] = [],
  options: { fetchNearbyLifeSpots?: NearbyLifeSpotFetcher; fetchEvents?: EventLifeSpotFetcher } = {}
): Promise<CurationRoute> {
  // 숙소는 사용자가 이미 머무는 곳이지 "일하러 이동할 목적지"가 아니므로 워케이션 동선에서는 제외한다.
  // 숙박 자체 추천은 /stay 페이지에서 별도로 다룬다.
  const nonStaySpots = availableSpots.filter((s) => s.category !== "hotel");

  // 워크스팟 쪽과 대칭되는 이유로 라이프스팟 쪽 숙박(category: "stay")도 여기서 배제한다.
  // balanceLifeSpots는 category !== "food"만 보고 나머지를 전부 "휴식"으로 취급하므로, 배제하지
  // 않으면 stay가 rest에 섞여 워크-라이프 동선에 숙박 시설이 등장할 수 있다(2026-07-28, P3 항목 2).
  // UI(app/ai-curator/page.tsx)는 attraction+food만 보내 실사용 경로에서는 발생하지 않지만,
  // /api/ai/curate를 직접 호출하는 경로까지 계약으로 강제하기 위해 여기서 명시적으로 막는다.
  const nonStayLifeSpots = availableLifeSpots.filter((s) => s.category !== "stay");

  // 옵션 B(2026-08-07): 이벤트 후보를 nonStayLifeSpots에 union한다(extendLifeSpotCandidates에
  // 넘기기 전). 이후 balanceLifeSpots가 워크스팟 기준 최단거리로 자동 재정렬/컷하도록 그대로
  // 맡긴다 — 이벤트 전용 고정 슬롯/우대 로직을 만들지 않는다(옵션 A 라운드의 D-② 함정 회피
  // 교훈 재사용: 관련성 높은 후보를 무조건 늘리면 거리가 오히려 회귀할 수 있음). 실패해도
  // 파이프라인이 중단되지 않도록 여기서도 방어적으로 catch한다(buildEventLifeSpotCorpus 자체가
  // 이미 빈 배열로 폴백하지만, DI로 다른 구현이 주입될 가능성에 대비한 이중 방어).
  const eventLifeSpots = options.fetchEvents
    ? await options.fetchEvents().catch((error) => {
        console.error("[ai] 이벤트 라이프스팟 조회 실패 — 이벤트 없이 진행:", error);
        return [] as LifeSpot[];
      })
    : [];
  const nonStayLifeSpotsWithEvents = [...nonStayLifeSpots, ...eventLifeSpots];

  // filterByPreferences의 "5곳 미만이면 조건 전체를 무시하고 원본으로 복귀" 폴백이 발동하면,
  // validateRoute는 여전히 엄격하게 검증하므로 LangGraph가 최대 3회(MAX_ATTEMPTS) 전부 실패할
  // 것이 이 시점에 이미 확정된다. 3회 낭비 대신 1회만 생성하고, 어떤 조건 조합이 문제인지 명시한다
  // (2026-07-27, P2 항목 1 결정 — 실측: 실제 231곳 코퍼스에서 "조용한 환경"+"콘센트 필수"+"무장애
  // 접근 가능" 3개 동시 선택도 7곳으로 임계값(5) 위였으나, barrierFree/power 데이터가 지금보다
  // 줄어들면 재현 가능한 경로라 방어적으로 남겨둔다. docs/AGENT_DESIGN.md "선호 조건 조기 종료 폴백"
  // 절 참고).
  const activeCheckablePreferences = CHECKABLE_PREFERENCES.filter((p) => request.preferences.includes(p));
  const strictMatchCount = activeCheckablePreferences.length > 0
    ? applyPreferenceFilters(nonStaySpots, request).length
    : nonStaySpots.length;

  const workSpots = await preFilter(nonStaySpots, request);
  // 위치기반 후보는 워크스팟 후보가 확정된 뒤에야 좌표 기준이 생기므로 preFilter 다음에 확장한다.
  // 확장 결과에 대해 적용하는 balanceLifeSpots(최근접 정렬 + 식당 확보)는 그대로 재사용한다.
  const lifeSpotCandidates = await extendLifeSpotCandidates(
    nonStayLifeSpotsWithEvents,
    workSpots,
    nonStaySpots,
    options.fetchNearbyLifeSpots
  );
  const lifeSpots = balanceLifeSpots(lifeSpotCandidates, workSpots, 15);

  if (activeCheckablePreferences.length > 0 && strictMatchCount < MIN_PREFERENCE_MATCHES) {
    const route = await generateOnce(request, workSpots, lifeSpots);
    // 재시도 루프(MAX_ATTEMPTS)는 다시 태우지 않는다 — 이미 "후보 자체가 부족해 재시도해도 소용없다"는
    // 것이 조기 종료의 전제이므로 validateRoute는 1회만 호출해 구조적 위반(워크스팟 개수/식당 누락/거리
    // 초과) 여부만 확인한다. preferences 위반(콘센트/무장애/조용한 환경)은 위 안내 문구가 이미 다루므로
    // structuralReasons에서 제외된다 (2026-07-27, QA FIX — 조기 종료가 validateRoute를 완전히 우회해
    // 296.5km짜리 동선이 무경고로 반환된 문제).
    const { structuralReasons } = validateRoute(route, request);
    const baseNote = `선택하신 조건(${activeCheckablePreferences.join(", ")})을 모두 만족하는 곳이 ${strictMatchCount}곳뿐이라, 조건을 완화한 결과를 보여드립니다.`;
    const validationNote =
      structuralReasons.length > 0
        ? `${baseNote} 다만 ${structuralReasons.join("; ")} 문제도 있어 참고해 주세요.`
        : baseNote;
    return finalizeRoute({ ...route, validationNote }, request, 1);
  }

  const result = await curationGraph.invoke({
    request,
    workSpots,
    lifeSpots,
    route: null,
    valid: false,
    reasons: [],
    attempt: 0,
  });

  const route = result.route as CurationRoute;
  // generateNode가 최소 1회는 실행되므로 attempt는 1 이상이지만, 상태 초기값(0)이 그대로 노출되는
  // 일이 없도록 하한을 둔다.
  const attempts = Math.max(1, result.attempt);
  if (!result.valid) {
    return finalizeRoute(
      { ...route, validationNote: "일부 조건을 만족하는 동선을 찾지 못해 근접한 결과를 보여드립니다." },
      request,
      attempts
    );
  }
  return finalizeRoute(route, request, attempts);
}
