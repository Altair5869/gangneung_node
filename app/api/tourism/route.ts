import { NextRequest, NextResponse } from "next/server";
import { getAreaBasedList, getLocationBasedList } from "@/lib/tourism-api";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") ?? "area";
  const mapX = searchParams.get("mapX");
  const mapY = searchParams.get("mapY");

  if (type === "nearby" && mapX && mapY) {
    const items = await getLocationBasedList(mapX, mapY);
    return NextResponse.json({ items });
  }

  const items = await getAreaBasedList();
  return NextResponse.json({ items });
}
