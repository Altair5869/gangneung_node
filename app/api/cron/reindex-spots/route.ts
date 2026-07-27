import { NextRequest, NextResponse } from "next/server";
import { buildSpotCorpus } from "@/lib/spot-corpus";
import { reindexSpots } from "@/lib/vector-store";

// Vercel Cron이 주기 호출하는 재색인 작업. 관광공사/카카오 API가 실시간으로 응답을 바꿀 수 있어
// 완전한 실시간 동기화 대신 "주기적 재색인"을 택한 트레이드오프를 여기서 실현한다.
//
// maxDuration: 실측(2026-07-27, 코퍼스 231곳/5배치, 429 재시도 없음) 82초. Voyage 429가 배치마다
// 최대 재시도(3회 × 기본 20초)를 전부 소진하는 최악의 경우 ~382초까지 늘어날 수 있어 Vercel Hobby
// 플랜의 함수 실행시간 상한(300초, fluid compute 기준)을 넘길 수 있다. 다만 이 최악의 경우는
// 5개 배치 전부가 연속으로 429를 3회씩 맞아야 하는 사실상 지속적 장애 상황이라 실측 대비 발생
// 가능성이 낮다고 판단해 배치 크기/재시도 정책은 그대로 두고 300초로 명시만 한다. 근거와
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

  const spots = await buildSpotCorpus();
  const upserted = await reindexSpots(spots);
  return NextResponse.json({ upserted });
}
