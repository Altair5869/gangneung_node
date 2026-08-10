import { NextRequest, NextResponse } from "next/server";
import { buildSpotCorpus, buildLifeSpotCorpus } from "@/lib/spot-corpus";
import { reindexSpots } from "@/lib/vector-store";

// Vercel Cron이 주기 호출하는 재색인 작업. 관광공사/카카오 API가 실시간으로 응답을 바꿀 수 있어
// 완전한 실시간 동기화 대신 "주기적 재색인"을 택한 트레이드오프를 여기서 실현한다.
//
// maxDuration: 실측(2026-07-27, 워크스팟 코퍼스 231곳/5배치, 429 재시도 없음) 82초. 옵션 D-②
// (2026-08-10)로 라이프스팟 정적 코퍼스(89곳, buildLifeSpotCorpus, "lifespots" 네임스페이스)가
// 배치 2개(ceil(89/50)=2) 추가돼 총 7배치가 됐다. **실측(2026-08-10, 로컬 dev 서버에 CRON_SECRET으로
// 직접 GET 호출, 429 재시도 없음): 전체(워크스팟+라이프스팟 순차) 약 150초** (`time curl`, 149.82초).
// 사전 추정치(110~120초)보다 실제로 더 걸렸다 — 추정은 "배치당 처리시간 14초 + 배치 간 대기 3초"만
// 반영했는데, 실측에는 이 외에 코퍼스 조회(buildSpotCorpus/buildLifeSpotCorpus, 관광공사/카카오 API
// 실호출) 자체의 왕복 시간도 섞여 있어 예상보다 늘어난 것으로 보인다. 그래도 Vercel Hobby 플랜
// 함수 실행시간 상한(300초, fluid compute 기준) 대비 절반 수준으로 여유는 충분하다.
// Voyage 429가 배치마다 최대 재시도(3회 × 기본 20초)를 전부 소진하는 최악의 경우 배치가 7개로
// 늘어난 만큼 최악 추정치도 기존 ~382초에서 ~536초로 늘어나 300초 상한을 더 크게 초과할 수 있다.
// 다만 이 최악의 경우는 7개 배치 전부가 연속으로 429를 3회씩 맞아야 하는 사실상 지속적 장애
// 상황이라 실측 대비 발생 가능성이 낮다는 기존 수용 기조(2026-07-27)를 이번 라운드도 그대로
// 유지한다 — 발생 확률이 아니라 발생 시 영향만 커지는 것으로 판단(요구사항 R4-1). 근거와
// "중단 시 부분 upsert 허용 가능" 판단은 docs/AGENT_DESIGN.md "재색인 실행시간 한도" 절 참고.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // 미설정 = 통과가 아니라 미설정 = 차단. CRON_SECRET이 없는 배포에서는
    // 누구나 GET 한 번으로 전체 코퍼스 재임베딩(Voyage 유료 API 호출)을 트리거할 수 있었다.
    return NextResponse.json(
      { error: "server_misconfigured", message: "이 배포에 인증이 구성되지 않았습니다." },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 옵션 D-②(2026-08-10): 워크스팟 → 기본 네임스페이스, 라이프스팟 정적 코퍼스 → "lifespots"
  // 네임스페이스 순으로 각각 재색인한다. 순서를 바꾸지 않는 이유: 기본 네임스페이스가 이미
  // 배포된 D-① 워크스팟 랭킹이 실제로 의존하는 쪽이라, 두 번째 호출(라이프스팟)이 실패해도
  // 워크스팟 재색인은 이미 커밋된 상태로 남는다.
  const spots = await buildSpotCorpus();
  const upserted = await reindexSpots(spots);

  const lifeSpots = await buildLifeSpotCorpus();
  const lifeSpotsUpserted = await reindexSpots(lifeSpots, "lifespots");

  return NextResponse.json({ upserted, lifeSpotsUpserted });
}
