import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserCheckinProgress } from "@/lib/community-checkin";

// R3: 체크인 챌린지/스탬프 투어 1차 진행률 조회. POST /api/checkins와 동일한 인증 패턴
// (auth(), session.user.id) — 로그인 필수, 비로그인 401. 쓰기가 아니라 SCARD 읽기 1회라
// 별도 레이트리밋을 추가하지 않는다(요구사항 문서 "영향 범위" 참고).
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const progress = await getUserCheckinProgress(userId);
  return NextResponse.json(progress);
}
