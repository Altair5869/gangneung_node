import { NextResponse } from "next/server";
import { getSpotById } from "@/lib/spot-detail";
import { auth } from "@/auth";
import { getUserCheckin } from "@/lib/community-checkin";

// 조회·병합 로직 본체는 lib/spot-detail.ts의 getSpotById에 있다. /spots/[id] 페이지도 같은
// 함수를 직접 호출한다 — 이 라우트는 공개 API 계약(`{ spot, myCheckin }` / 404)만 유지하는
// 얇은 래퍼다. myCheckin(R5-2)은 로그인 상태일 때만 채워지고, 비로그인이면 null이다 — 기존
// `{ spot }` 계약에 필드를 추가만 한 것이라 이전 클라이언트도 깨지지 않는다(하위 호환).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const spot = await getSpotById(id);
  if (!spot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth();
  const myCheckin = session?.user?.id ? await getUserCheckin(id, session.user.id) : null;

  return NextResponse.json({ spot, myCheckin });
}
