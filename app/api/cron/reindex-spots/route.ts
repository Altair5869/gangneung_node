import { NextRequest, NextResponse } from "next/server";
import { buildSpotCorpus } from "@/lib/spot-corpus";
import { reindexSpots } from "@/lib/vector-store";

// Vercel Cron이 주기 호출하는 재색인 작업. 관광공사/카카오 API가 실시간으로 응답을 바꿀 수 있어
// 완전한 실시간 동기화 대신 "주기적 재색인"을 택한 트레이드오프를 여기서 실현한다.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const spots = await buildSpotCorpus();
  const upserted = await reindexSpots(spots);
  return NextResponse.json({ upserted });
}
