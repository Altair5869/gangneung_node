import { NextRequest, NextResponse } from "next/server";
import { getAreaBasedList, getLocationBasedList } from "@/lib/tourism-api";

// 위치기반 조회(type=nearby)의 실제 사용처는 AI 큐레이션 경로다 —
// /api/ai/curate → curateRoute → buildNearbyLifeSpotCorpus → getLocationBasedList.
// 이 라우트는 같은 조회를 화면·디버깅용으로 직접 확인할 수 있게 남겨 둔 얇은 패스스루이며,
// getLocationBasedList의 확장된 시그니처(radius/contentTypeId)를 그대로 노출한다(2026-08-05).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") ?? "area";
  const mapX = searchParams.get("mapX");
  const mapY = searchParams.get("mapY");

  if (type === "nearby" && mapX && mapY) {
    const radius = searchParams.get("radius") ?? "1000";
    const contentTypeId = searchParams.get("contentTypeId") ?? undefined;
    const items = await getLocationBasedList(mapX, mapY, radius, contentTypeId);
    return NextResponse.json({ items });
  }

  const items = await getAreaBasedList();
  return NextResponse.json({ items });
}
