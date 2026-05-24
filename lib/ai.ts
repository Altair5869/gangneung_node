import Anthropic from "@anthropic-ai/sdk";
import { WorkSpot, CurationRequest, CurationRoute } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function curateRoute(
  request: CurationRequest,
  availableSpots: WorkSpot[]
): Promise<CurationRoute> {
  const spotsContext = availableSpots
    .map(
      (s) =>
        `- ${s.name} (${s.category}): 소음=${s.noise}, WiFi=${s.wifi.available ? s.wifi.speedMbps + "Mbps" : "없음"}, 콘센트=${s.power.available ? "있음" : "없음"}, 태그=[${s.tags.join(", ")}]`
    )
    .join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system:
      "당신은 강릉 워케이션 전문 큐레이터입니다. 사용자의 업무 스타일에 맞는 최적의 동선을 JSON으로 제안해주세요.",
    messages: [
      {
        role: "user",
        content: `사용자 요청: ${request.workStyle}
업무 시간: ${request.duration}시간
선호도: ${request.preferences.join(", ")}

사용 가능한 장소 목록:
${spotsContext}

다음 JSON 형식으로 응답해주세요:
{
  "spotIds": ["id1", "id2"],
  "description": "추천 동선 설명",
  "tips": ["팁1", "팁2"]
}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 응답 파싱 실패");

  const parsed = JSON.parse(jsonMatch[0]) as {
    spotIds: string[];
    description: string;
    tips: string[];
  };

  const selectedSpots = parsed.spotIds
    .map((id) => availableSpots.find((s) => s.id === id))
    .filter((s): s is WorkSpot => s !== undefined);

  return {
    spots: selectedSpots,
    totalDuration: request.duration,
    description: parsed.description,
    tips: parsed.tips,
  };
}
