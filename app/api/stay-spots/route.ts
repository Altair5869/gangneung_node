import { NextResponse } from "next/server";
import { getStayList } from "@/lib/tourism-api";
import { mapTourismToStaySpot } from "@/lib/tourism-mapper";

export async function GET() {
  try {
    const items = await getStayList();
    const spots = items
      .filter((item) => item.mapx && item.mapy && parseFloat(item.mapx) !== 0)
      .map(mapTourismToStaySpot);
    return NextResponse.json({ spots });
  } catch {
    return NextResponse.json({ spots: [] });
  }
}
