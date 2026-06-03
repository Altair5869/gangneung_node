import Anthropic from "@anthropic-ai/sdk";
import { WorkSpot, CurationRequest, CurationRoute } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RECOMMEND_TOOL: Anthropic.Tool = {
  name: "recommend_route",
  description: "사용자 업무 스타일에 맞는 워케이션 동선을 추천합니다.",
  input_schema: {
    type: "object" as const,
    properties: {
      spotIds: {
        type: "array",
        items: { type: "string" },
        description: "추천 장소 ID 목록 (2~4개, 제공된 목록의 id 값 그대로 사용)",
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

// 사용자 선호도 기반 사전 필터 → AI에 보낼 스팟 최대 30개로 압축
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

  // 선호도 필터 후 너무 적으면 원본으로 fallback
  const base = filtered.length >= 5 ? filtered : spots;

  // 혼잡도 낮은 순 정렬 후 30개 제한
  const order: Record<string, number> = { low: 0, medium: 1, high: 2 };
  return base
    .sort((a, b) => (order[a.congestion ?? "medium"] ?? 1) - (order[b.congestion ?? "medium"] ?? 1))
    .slice(0, 30);
}

function buildSpotsContext(spots: WorkSpot[]): string {
  return spots
    .map(
      (s) =>
        `id:${s.id} | ${s.name} (${s.category}) | 소음:${s.noise} | WiFi:${s.wifi.available ? "O" : "X"} | 콘센트:${s.power.available ? "O" : "X"} | 혼잡도:${s.congestion ?? "보통"} | 태그:[${s.tags.join(",")}]`
    )
    .join("\n");
}

export async function curateRoute(
  request: CurationRequest,
  availableSpots: WorkSpot[]
): Promise<CurationRoute> {
  const spots = preFilter(availableSpots, request);
  const spotsContext = buildSpotsContext(spots);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: "당신은 강릉 워케이션 전문 큐레이터입니다. 사용자의 업무 스타일과 선호도를 분석해 최적의 하루 동선을 추천합니다. 반드시 제공된 장소 목록에서만 선택하고, id 값을 정확히 사용하세요.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `사용 가능한 강릉 워크스팟 (${spots.length}개):\n${spotsContext}`,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: `업무 스타일: ${request.workStyle}\n업무 시간: ${request.duration}시간\n선호 조건: ${request.preferences.length > 0 ? request.preferences.join(", ") : "없음"}\n\n위 목록에서 최적의 워케이션 동선 2~4곳을 추천해주세요.`,
          },
        ],
      },
    ],
    tools: [RECOMMEND_TOOL],
    tool_choice: { type: "tool", name: "recommend_route" },
  });

  // tool use 결과 추출
  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("AI 응답 오류");

  const parsed = toolUse.input as {
    spotIds: string[];
    description: string;
    tips: string[];
  };

  const selectedSpots = parsed.spotIds
    .map((id) => spots.find((s) => s.id === id))
    .filter((s): s is WorkSpot => s !== undefined);

  if (selectedSpots.length === 0) throw new Error("추천 장소를 찾을 수 없습니다");

  return {
    spots: selectedSpots,
    totalDuration: request.duration,
    description: parsed.description,
    tips: parsed.tips,
  };
}
