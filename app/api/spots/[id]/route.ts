import { NextResponse } from "next/server";
import { getSpotById } from "@/lib/spot-detail";

// 조회·병합 로직 본체는 lib/spot-detail.ts의 getSpotById에 있다. /spots/[id] 페이지도 같은
// 함수를 직접 호출한다 — 이 라우트는 공개 API 계약(`{ spot }` / 404)만 유지하는 얇은 래퍼다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const spot = await getSpotById(id);
  if (!spot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ spot });
}
