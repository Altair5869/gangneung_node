import Anthropic from "@anthropic-ai/sdk";
import { WorkSpot, LifeSpot, RouteStop, CurationRequest, CurationRoute, isLifeSpot } from "@/types";
import { embed, cosineSimilarity } from "@/lib/embeddings";
import { isBarrierFree } from "@/lib/utils";

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

function filterByPreferences(spots: WorkSpot[], request: CurationRequest): WorkSpot[] {
  let filtered = [...spots];

  if (request.preferences.includes("조용한 환경"))
    filtered = filtered.filter((s) => s.noise === "언급됨-조용함");
  if (request.preferences.includes("콘센트 필수"))
    filtered = filtered.filter((s) => s.power.level === "충분함" || s.power.level === "제한적");
  if (request.preferences.includes("무장애 접근 가능"))
    filtered = filtered.filter((s) => isBarrierFree(s.barrierFree));

  return filtered.length >= 5 ? filtered : spots;
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

async function rankCandidates(spots: WorkSpot[], request: CurationRequest): Promise<WorkSpot[]> {
  if (request.freeText && request.freeText.trim().length > 0) {
    return semanticSort(request.freeText.trim(), spots);
  }
  const order: Record<string, number> = { low: 0, medium: 1, high: 2 };
  return [...spots].sort((a, b) => (order[a.congestion ?? "medium"] ?? 1) - (order[b.congestion ?? "medium"] ?? 1));
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
      return `id:${s.id} | ${s.name} (${s.category}) | lat:${s.lat.toFixed(4)} lng:${s.lng.toFixed(4)} | 소음:${s.noise === "언급없음" ? "미확인" : s.noise} | WiFi:${s.wifi.available ? "O" : "X"} | 콘센트:${s.power.level ?? "미확인"} | 태그:[${s.tags.join(",")}]${desc}`;
    })
    .join("\n");
}

const LIFE_CATEGORY_LABEL: Record<LifeSpot["category"], string> = {
  attraction: "관광지",
  stay: "숙박",
  food: "식당",
};

function buildLifeSpotsContext(spots: LifeSpot[]): string {
  return spots
    .map((s) => `id:${s.id} | ${s.name} (${LIFE_CATEGORY_LABEL[s.category]}) | lat:${s.lat.toFixed(4)} lng:${s.lng.toFixed(4)} | 태그:[${s.tags.join(",")}]`)
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

export function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const freeTextLine = request.freeText
    ? `\n자유 요청사항: "${request.freeText}"\n중요: 워크스팟 후보 목록은 이 요청과의 관련도가 높은 순서로 정렬되어 있습니다. 다른 제약 조건(콘센트 등) 위반이 없는 한, 반드시 목록 상위 3~5개 안에서 workSpotId를 고르세요. 하위권 후보는 이 요청과 관련이 적으니 우선순위에서 제외하세요. 자유 요청사항과 관련된 특징(예: 바다뷰)은 후보의 '설명' 필드에 실제로 근거가 있을 때만 언급하고, 근거 없이 지어내지 마세요.`
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
            text: `업무 스타일: ${request.workStyle}\n업무 시간: ${request.duration}시간\n선호 조건: ${request.preferences.length > 0 ? request.preferences.join(", ") : "없음"}${freeTextLine}\n\n워크-라이프 동선을 구성해주세요:\n- 워크스팟 정확히 1곳 (집중 업무. 업무 중간에 다른 워크스팟으로 옮기지 말고 한 곳에 머무를 것)\n- 관광지/휴식 스팟 1~2곳 (업무 사이 휴식·여가. 해변·전망 등 숨 돌릴 수 있는 곳)\n- 식당 1곳 (식사)\n이동 거리를 고려해 가까운 장소끼리 배치하세요.\n주의: 사용자가 시작 시간을 지정하지 않았으므로 특정 시간대(아침/오후 등)를 지어내지 마세요. 정확한 이동 거리·소요 시간 수치도 알 수 없으니 언급하지 마세요. stopNotes는 반드시 order와 같은 순서로 작성하세요.${feedbackText}`,
          },
        ],
      },
    ],
    tools: [RECOMMEND_TOOL],
    tool_choice: { type: "tool", name: "recommend_route" },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("AI 응답 오류");

  const parsed = toolUse.input as {
    workSpotId: string;
    lifeSpotIds: string[];
    order: string[];
    summary: string;
    stopNotes: string[];
    tips: string[];
  };

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

function validateRoute(
  route: CurationRoute,
  request: CurationRequest
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const workStops = route.spots.filter((s): s is WorkSpot => !isLifeSpot(s));

  if (workStops.length !== 1) {
    reasons.push(`워크스팟은 정확히 1곳이어야 합니다: 현재 ${workStops.length}곳`);
  }

  const hasFood = route.spots.some((s) => isLifeSpot(s) && s.category === "food");
  if (!hasFood) {
    reasons.push("식당이 동선에 포함되지 않았습니다");
  }

  if (request.preferences.includes("콘센트 필수")) {
    workStops.forEach((s) => {
      if (s.power.level !== "충분함" && s.power.level !== "제한적") {
        reasons.push(`콘센트 조건 위반: ${s.name}`);
      }
    });
  }

  if (request.preferences.includes("무장애 접근 가능")) {
    workStops.forEach((s) => {
      if (!isBarrierFree(s.barrierFree)) {
        reasons.push(`무장애 조건 위반: ${s.name}`);
      }
    });
  }

  if (request.preferences.includes("조용한 환경")) {
    workStops.forEach((s) => {
      if (s.noise === "언급됨-시끄러움") {
        reasons.push(`조용한 환경 조건 위반: ${s.name}`);
      }
    });
  }

  const threshold = distanceThresholdFor(request.duration);
  const distance = totalSequentialDistance(route.spots);
  if (distance > threshold) {
    reasons.push(`이동 거리 초과: 총 ${distance.toFixed(1)}km (기준 ${threshold}km)`);
  }

  return { valid: reasons.length === 0, reasons };
}

const MAX_ATTEMPTS = 3;

// Claude는 좌표만 보고 실제 km 단위 거리를 정확히 알 수 없어 tips에 근거 없는 수치를
// 지어낼 수 있다 (예: "500m 이내"). 프롬프트로 언급을 막는 것과 별개로, 실제 이동거리는
// 코드로 계산한 값만 사실로 노출한다.
function withDistanceTip(route: CurationRoute): CurationRoute {
  const distance = totalSequentialDistance(route.spots);
  return { ...route, tips: [...route.tips, `실제 총 이동 거리: 약 ${distance.toFixed(1)}km`] };
}

function formatClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 같은 이유로(수치 환각 방지), 시작 시간이 주어졌을 때의 예상 일정도 Claude가 아니라
// 코드가 계산한다. 워크스팟은 요청한 업무 시간만큼, 식당은 1시간, 관광지/휴식은 45분으로 고정 배분.
function buildSchedule(spots: RouteStop[], request: CurationRequest, startHour: number): string[] {
  let cursor = startHour * 60;
  return spots.map((spot) => {
    const blockMin = isLifeSpot(spot) ? (spot.category === "food" ? 60 : 45) : request.duration * 60;
    const start = formatClock(cursor);
    cursor += blockMin;
    const end = formatClock(cursor);
    const label = isLifeSpot(spot) ? spot.name : `${spot.name} (업무)`;
    return `${start}~${end} ${label}`;
  });
}

function finalizeRoute(route: CurationRoute, request: CurationRequest): CurationRoute {
  const withDistance = withDistanceTip(route);
  if (request.startHour === undefined) return withDistance;
  return { ...withDistance, schedule: buildSchedule(withDistance.spots, request, request.startHour) };
}

export async function curateRoute(
  request: CurationRequest,
  availableSpots: WorkSpot[],
  availableLifeSpots: LifeSpot[] = []
): Promise<CurationRoute> {
  // 숙소는 사용자가 이미 머무는 곳이지 "일하러 이동할 목적지"가 아니므로 워케이션 동선에서는 제외한다.
  // 숙박 자체 추천은 /stay 페이지에서 별도로 다룬다.
  const nonStaySpots = availableSpots.filter((s) => s.category !== "hotel");
  const workSpots = await preFilter(nonStaySpots, request);
  const lifeSpots = balanceLifeSpots(availableLifeSpots, workSpots, 15);

  let route = await generateOnce(request, workSpots, lifeSpots);
  let { valid, reasons } = validateRoute(route, request);

  for (let attempt = 1; attempt < MAX_ATTEMPTS && !valid; attempt++) {
    route = await generateOnce(request, workSpots, lifeSpots, reasons.join("; "));
    ({ valid, reasons } = validateRoute(route, request));
  }

  if (!valid) {
    return finalizeRoute(
      { ...route, validationNote: "일부 조건을 만족하는 동선을 찾지 못해 근접한 결과를 보여드립니다." },
      request
    );
  }
  return finalizeRoute(route, request);
}
