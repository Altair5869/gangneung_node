import { NextRequest, NextResponse } from "next/server";
import { curateRoute } from "@/lib/ai";
import { buildSpotCorpus, buildLifeSpotCorpus } from "@/lib/spot-corpus";
import { CurationRequest, WorkSpot, LifeSpot } from "@/types";

interface CurateRequestBody {
  curationRequest: CurationRequest;
  spots: WorkSpot[];
  lifeSpots?: LifeSpot[];
}

// UI(app/ai-curator/page.tsx)가 실제로 보내는 값은 2/4/6/8뿐이다. 그 외 값도 크래시는 안 나지만
// (distanceThresholdFor가 최근접 버킷으로 매핑, docs/AGENT_DESIGN.md 참고) API 계약을 명시적으로
// 강제해, 직접 호출하는 제3자/향후 QA 자동화가 암묵적 매핑 규칙에 기대지 않게 한다(2026-07-28, P3 항목 4).
const VALID_DURATIONS = [2, 4, 6, 8];

// curateRoute가 곧바로 workStyle/duration/preferences에 의존하므로(예: filterByPreferences,
// distanceThresholdFor) 형태가 맞는지만 확인한다. 값의 의미(예: workStyle이 실제로 유효한
// 카테고리인지)는 curateRoute/validateRoute의 책임 범위이므로 여기서는 검증하지 않는다.
function isValidCurationRequest(value: unknown): value is CurationRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.workStyle === "string" &&
    typeof v.duration === "number" &&
    VALID_DURATIONS.includes(v.duration) &&
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
          `curationRequest 필드에 workStyle(문자열), duration(${VALID_DURATIONS.join("/")} 중 하나), preferences(배열)가 필요합니다.`,
      },
      { status: 400 }
    );
  }

  try {
    // 클라이언트가 보낸 spots/lifeSpots는 "어떤 id를 후보로 쓸지"에 대한 힌트로만 쓰고, 실제 필드
    // 값은 서버가 buildSpotCorpus()/buildLifeSpotCorpus()로 직접 조회한 코퍼스 쪽 값으로 전량
    // 치환한다. 존재하지 않는 id("fake-1" 등 조작된 스팟)는 대조 과정에서 자동으로 사라지고,
    // wifi.available/power.level/noise/barrierFree/description(프롬프트 인젝션 경로) 등 어떤 필드를
    // 위조해서 보내도 판정·프롬프트 조립에는 서버 코퍼스 값만 쓰인다(2026-07-28, P3 항목 1).
    const [workCorpus, lifeCorpus] = await Promise.all([buildSpotCorpus(), buildLifeSpotCorpus()]);
    const workById = new Map(workCorpus.map((s) => [s.id, s]));
    const lifeById = new Map(lifeCorpus.map((s) => [s.id, s]));

    const verifiedSpots = body.spots
      .map((s) => workById.get(s?.id))
      .filter((s): s is WorkSpot => s !== undefined);
    const verifiedLifeSpots = (body.lifeSpots ?? [])
      .map((s) => lifeById.get(s?.id))
      .filter((s): s is LifeSpot => s !== undefined);

    const route = await curateRoute(body.curationRequest, verifiedSpots, verifiedLifeSpots);
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
