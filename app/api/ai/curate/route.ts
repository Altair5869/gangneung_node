import { NextRequest, NextResponse } from "next/server";
import { curateRoute } from "@/lib/ai";
import { buildSpotCorpus, buildLifeSpotCorpus, buildNearbyLifeSpotCorpus } from "@/lib/spot-corpus";
import { CurationRequest, WorkSpot, LifeSpot } from "@/types";

// spots/lifeSpots는 워크스팟/라이프스팟 전체 객체가 아니라 id 문자열 배열이다. 클라이언트는
// "이 id들을 후보로 써 달라"는 힌트만 보내고, 실제 필드 값은 아래에서 서버 코퍼스로 전량
// 재조회한다 — 필드를 애초에 받지 않으므로 위조 경로 자체가 타입 레벨에서 없다(2026-08-07,
// 옵션 K 요구사항 1, 페이로드 다이어트).
interface CurateRequestBody {
  curationRequest: CurationRequest;
  spots: string[];
  lifeSpots?: string[];
}

// UI(app/ai-curator/page.tsx)가 실제로 보내는 값은 2/4/6/8뿐이다. 그 외 값도 크래시는 안 나지만
// (distanceThresholdFor가 최근접 버킷으로 매핑, docs/AGENT_DESIGN.md 참고) API 계약을 명시적으로
// 강제해, 직접 호출하는 제3자/향후 QA 자동화가 암묵적 매핑 규칙에 기대지 않게 한다(2026-07-28, P3 항목 4).
const VALID_DURATIONS = [2, 4, 6, 8];

// maxDuration: 이 라우트는 사용자가 브라우저에서 직접 기다리는 동기 경로다(cron과 달리 백그라운드
// 작업이 아님) — 미선언 시 Vercel 플랫폼 기본 타임아웃(플랜에 따라 10초 수준)에 걸려 정상 케이스도
// 조기 504가 날 수 있다.
//
// 실측(2026-07-28, 로컬 dev, 실제 Voyage/Claude 호출, 코퍼스 231곳 기준, 재시도 없이 1회 성공):
//   - freeText 없음(혼잡도 정렬만, 벡터/임베딩 미사용): 12.4초
//   - freeText 있음 + Upstash Vector 색인 사용(queryTopK 빠른 경로): 13.6초
//   - freeText 있음 + Upstash Vector 미설정 강제(semanticSort 실시간 재임베딩 폴백, 429 없음): 13.6초
//   → 코퍼스 조회(buildSpotCorpus/buildLifeSpotCorpus, 각 0.05초 안팎)는 병목이 아니고, Claude
//     haiku 호출 1회 왕복이 대부분을 차지한다. 세 경로 모두 재시도 없는 1회 성공 기준 12~14초대로
//     수렴함 — "이 값 자체"를 그대로 상한으로 쓰면 안 되고(재시도/429를 안 겪은 낙관적 경우), 아래
//     최악 추정의 기준선으로만 사용한다.
//   - 참고: 후보(spots)가 실제로 비어 클라이언트-서버 id 교집합이 0건이 되는 예외 케이스는
//     curationGraph가 MAX_ATTEMPTS(3회) Claude 호출을 전부 소진하고도 "추천 장소를 찾을 수
//     없습니다" 500을 던지는데, 이때도 4.7초에 끝났다 — Claude 호출 자체는 빠르고, 위 12~14초는
//     대부분 코퍼스 조회+임베딩+응답 조립까지 합친 시간이다.
// 최악 추정(코드 추적, docs/AGENT_DESIGN.md "Node1/Node2 재시도 루프" 참고):
//   - Voyage 429가 겹치면 embed()가 MAX_RETRIES=3회 × 기본 20초 대기를 전부 소진해 semanticSort
//     한 번이 최대 ~60초까지 늘어날 수 있음(lib/embeddings.ts).
//   - validateRoute가 계속 불합격이면 curationGraph가 generateNode(Claude 호출)를 MAX_ATTEMPTS=3회
//     반복(lib/ai.ts) — 위 실측 기준 Claude 왕복을 12~14초로 잡으면 3회 합 최대 ~42초.
//   - 랭킹 폴백(최대 ~60초, 요청당 1회만 발생)과 Claude 재시도(최대 ~42초)가 겹치는 최악의 경우
//     합산 ~100초. Vercel Hobby 함수 실행시간 상한(300초, fluid compute 기준, 재색인 라우트 주석
//     참고)에는 여유가 있으나, 위 실측(12~14초)의 8~10배에 해당하는 값이라 여유를 두고 120초로
//     명시한다 — 사용자 대면 경로라 값을 낮게 잡아 정상 케이스까지 조기 타임아웃 나는 쪽이
//     더 나쁘다고 판단.
export const maxDuration = 120;

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
      .map((id) => workById.get(id))
      .filter((s): s is WorkSpot => s !== undefined);
    const verifiedLifeSpots = (body.lifeSpots ?? [])
      .map((id) => lifeById.get(id))
      .filter((s): s is LifeSpot => s !== undefined);

    // 라이프스팟 후보를 위 id 대조 결과(클라이언트가 보낸 목록의 교집합)만으로 두면, 서버가
    // 위치기반 API로 새로 찾아낸 후보는 클라이언트가 그 id를 보낸 적이 없어 영원히 채택될 수
    // 없다. 그래서 서버가 직접 조회한 후보를 curateRoute 안에서 union하는 경로를 여기서
    // 명시적으로 열어 준다(요구사항 R2-2). 이건 "클라이언트 값을 신뢰하지 않는다"는 원칙과
    // 충돌하지 않는다 — 추가되는 값의 출처가 클라이언트 입력이 아니라 관광공사 API 응답이다.
    // 좌표 기준(워크스팟 랭킹 상위)은 preFilter 이후에야 정해지므로 조회 함수를 주입만 한다.
    const route = await curateRoute(body.curationRequest, verifiedSpots, verifiedLifeSpots, {
      fetchNearbyLifeSpots: buildNearbyLifeSpotCorpus,
    });
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
