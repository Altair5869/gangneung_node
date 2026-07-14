import Anthropic from "@anthropic-ai/sdk";
import { WorkSpot, LifeSpot, RouteStop, CurationRequest, CurationRoute, isLifeSpot } from "@/types";
import { embed, cosineSimilarity } from "@/lib/embeddings";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RECOMMEND_TOOL: Anthropic.Tool = {
  name: "recommend_route",
  description: "사용자 업무 스타일에 맞는 워크-라이프 동선을 추천합니다.",
  input_schema: {
    type: "object" as const,
    properties: {
      spotIds: {
        type: "array",
        items: { type: "string" },
        description: "추천 장소 ID 목록 (3~5개, 워크스팟과 관광지 혼합, 제공된 목록의 id 값 그대로 사용)",
      },
      description: {
        type: "string",
        description: "추천 동선 전체 설명 (2~3문장, 한국어)",
      },
      tips: {
        type: "array",
        items: { type: "string" },
        description: "워케이션 실용 팁 2~3개 (한국어)",
      },
    },
    required: ["spotIds", "description", "tips"],
  },
};

function filterByPreferences(spots: WorkSpot[], request: CurationRequest): WorkSpot[] {
  let filtered = [...spots];

  if (request.preferences.includes("조용한 환경"))
    filtered = filtered.filter((s) => s.noise === "언급됨-조용함");
  if (request.preferences.includes("빠른 WiFi"))
    filtered = filtered.filter((s) => s.wifi.available);
  if (request.preferences.includes("콘센트 필수"))
    filtered = filtered.filter((s) => s.power.level === "충분함" || s.power.level === "제한적");
  if (request.preferences.includes("무장애 접근 가능"))
    filtered = filtered.filter((s) => s.barrierFree !== undefined);

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

async function preFilter(spots: WorkSpot[], request: CurationRequest): Promise<WorkSpot[]> {
  const filtered = filterByPreferences(spots, request);
  const ranked = await rankCandidates(filtered, request);
  return ranked.slice(0, 30);
}

function buildWorkSpotsContext(spots: WorkSpot[]): string {
  return spots
    .map(
      (s) =>
        `id:${s.id} | ${s.name} (${s.category}) | lat:${s.lat.toFixed(4)} lng:${s.lng.toFixed(4)} | 소음:${s.noise === "언급없음" ? "미확인" : s.noise} | WiFi:${s.wifi.available ? "O" : "X"} | 콘센트:${s.power.level ?? "미확인"} | 태그:[${s.tags.join(",")}]`
    )
    .join("\n");
}

function buildLifeSpotsContext(spots: LifeSpot[]): string {
  return spots
    .map((s) => `id:${s.id} | ${s.name} (관광지) | lat:${s.lat.toFixed(4)} lng:${s.lng.toFixed(4)} | 태그:[${s.tags.join(",")}]`)
    .join("\n");
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

function nearestNeighborSort(spots: RouteStop[]): RouteStop[] {
  if (spots.length <= 2) return spots;
  const remaining = [...spots];
  const result: RouteStop[] = [remaining.splice(0, 1)[0]];
  while (remaining.length > 0) {
    const cur = result[result.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = calculateHaversineDistance(cur.lat, cur.lng, s.lat, s.lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });
    result.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return result;
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
            text: `업무 스타일: ${request.workStyle}\n업무 시간: ${request.duration}시간\n선호 조건: ${request.preferences.length > 0 ? request.preferences.join(", ") : "없음"}\n\n워크-라이프 동선을 구성해주세요:\n- 워크스팟 2~3곳 (집중 업무)\n- 관광지/라이프스팟 1~2곳 (업무 사이 휴식·여가)\n이동 거리를 고려해 가까운 장소끼리 배치하고, 총 3~5곳을 선택하세요.${feedbackText}`,
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
    spotIds: string[];
    description: string;
    tips: string[];
  };

  const allSpots: RouteStop[] = [...workSpots, ...lifeSpots];
  const selectedSpots = parsed.spotIds
    .map((id) => allSpots.find((s) => s.id === id))
    .filter((s): s is RouteStop => s !== undefined);

  if (selectedSpots.length === 0) throw new Error("추천 장소를 찾을 수 없습니다");

  return {
    spots: nearestNeighborSort(selectedSpots),
    totalDuration: request.duration,
    description: parsed.description,
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

  if (request.preferences.includes("콘센트 필수")) {
    workStops.forEach((s) => {
      if (s.power.level !== "충분함" && s.power.level !== "제한적") {
        reasons.push(`콘센트 조건 위반: ${s.name}`);
      }
    });
  }

  if (request.preferences.includes("무장애 접근 가능")) {
    workStops.forEach((s) => {
      if (s.barrierFree === undefined) {
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

export async function curateRoute(
  request: CurationRequest,
  availableSpots: WorkSpot[],
  availableLifeSpots: LifeSpot[] = []
): Promise<CurationRoute> {
  const workSpots = await preFilter(availableSpots, request);
  const lifeSpots = availableLifeSpots.slice(0, 15);

  let route = await generateOnce(request, workSpots, lifeSpots);
  let { valid, reasons } = validateRoute(route, request);

  for (let attempt = 1; attempt < MAX_ATTEMPTS && !valid; attempt++) {
    route = await generateOnce(request, workSpots, lifeSpots, reasons.join("; "));
    ({ valid, reasons } = validateRoute(route, request));
  }

  if (!valid) {
    return {
      ...route,
      validationNote: "일부 조건을 만족하는 동선을 찾지 못해 근접한 결과를 보여드립니다.",
    };
  }
  return route;
}
