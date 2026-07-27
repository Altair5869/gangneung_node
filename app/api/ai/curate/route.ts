import { NextRequest, NextResponse } from "next/server";
import { curateRoute } from "@/lib/ai";
import { CurationRequest, WorkSpot, LifeSpot } from "@/types";

interface CurateRequestBody {
  curationRequest: CurationRequest;
  spots: WorkSpot[];
  lifeSpots?: LifeSpot[];
}

// curateRoute가 곧바로 workStyle/duration/preferences에 의존하므로(예: filterByPreferences,
// distanceThresholdFor) 형태가 맞는지만 확인한다. 값의 의미(예: workStyle이 실제로 유효한
// 카테고리인지)는 curateRoute/validateRoute의 책임 범위이므로 여기서는 검증하지 않는다.
function isValidCurationRequest(value: unknown): value is CurationRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.workStyle === "string" &&
    typeof v.duration === "number" &&
    Array.isArray(v.preferences)
  );
}

export async function POST(request: NextRequest) {
  let body: CurateRequestBody | null;
  try {
    body = (await request.json()) as CurateRequestBody | null;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "요청 본문이 올바른 JSON 형식이 아닙니다." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body?.spots)) {
    return NextResponse.json(
      { error: "invalid_spots", message: "spots 필드는 배열이어야 합니다." },
      { status: 400 }
    );
  }

  if (!isValidCurationRequest(body?.curationRequest)) {
    return NextResponse.json(
      {
        error: "invalid_curation_request",
        message:
          "curationRequest 필드에 workStyle(문자열), duration(숫자), preferences(배열)가 필요합니다.",
      },
      { status: 400 }
    );
  }

  try {
    const route = await curateRoute(body.curationRequest, body.spots, body.lifeSpots ?? []);
    return NextResponse.json({ route });
  } catch (error) {
    // ANTHROPIC_API_KEY 미설정 등 curateRoute 내부 예외를 그대로 클라이언트에 노출하지 않는다.
    console.error("[/api/ai/curate] curateRoute failed:", error);
    return NextResponse.json(
      {
        error: "curation_failed",
        message: "AI 큐레이션 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 }
    );
  }
}
