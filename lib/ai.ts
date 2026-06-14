import Anthropic from "@anthropic-ai/sdk";
import { WorkSpot, LifeSpot, RouteStop, CurationRequest, CurationRoute } from "@/types";

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

function preFilter(spots: WorkSpot[], request: CurationRequest): WorkSpot[] {
  let filtered = [...spots];

  if (request.preferences.includes("조용한 환경"))
    filtered = filtered.filter((s) => s.noise === "quiet");
  if (request.preferences.includes("빠른 WiFi"))
    filtered = filtered.filter((s) => s.wifi.available);
  if (request.preferences.includes("콘센트 필수"))
    filtered = filtered.filter((s) => s.power.available);
  if (request.preferences.includes("무장애 접근 가능"))
    filtered = filtered.filter((s) => s.barrierFree !== undefined);

  const base = filtered.length >= 5 ? filtered : spots;

  const order: Record<string, number> = { low: 0, medium: 1, high: 2 };
  return base
    .sort((a, b) => (order[a.congestion ?? "medium"] ?? 1) - (order[b.congestion ?? "medium"] ?? 1))
    .slice(0, 30);
}

function buildWorkSpotsContext(spots: WorkSpot[]): string {
  return spots
    .map(
      (s) =>
        `id:${s.id} | ${s.name} (${s.category}) | lat:${s.lat.toFixed(4)} lng:${s.lng.toFixed(4)} | 소음:${s.noise} | WiFi:${s.wifi.available ? "O" : "X"} | 콘센트:${s.power.available ? "O" : "X"} | 태그:[${s.tags.join(",")}]`
    )
    .join("\n");
}

function buildLifeSpotsContext(spots: LifeSpot[]): string {
  return spots
    .map((s) => `id:${s.id} | ${s.name} (관광지) | lat:${s.lat.toFixed(4)} lng:${s.lng.toFixed(4)} | 태그:[${s.tags.join(",")}]`)
    .join("\n");
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
      const d = Math.hypot(s.lat - cur.lat, s.lng - cur.lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });
    result.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return result;
}

export async function curateRoute(
  request: CurationRequest,
  availableSpots: WorkSpot[],
  availableLifeSpots: LifeSpot[] = []
): Promise<CurationRoute> {
  const workSpots = preFilter(availableSpots, request);
  const lifeSpots = availableLifeSpots.slice(0, 15);

  const workContext = buildWorkSpotsContext(workSpots);
  const lifeContext = lifeSpots.length > 0
    ? `\n\n[관광지/라이프스팟 (${lifeSpots.length}개)]\n${buildLifeSpotsContext(lifeSpots)}`
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
            text: `업무 스타일: ${request.workStyle}\n업무 시간: ${request.duration}시간\n선호 조건: ${request.preferences.length > 0 ? request.preferences.join(", ") : "없음"}\n\n워크-라이프 동선을 구성해주세요:\n- 워크스팟 2~3곳 (집중 업무)\n- 관광지/라이프스팟 1~2곳 (업무 사이 휴식·여가)\n이동 거리를 고려해 가까운 장소끼리 배치하고, 총 3~5곳을 선택하세요.`,
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
