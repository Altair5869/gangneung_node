import { NextResponse } from "next/server";
import { getFoodList } from "@/lib/tourism-api";
import { mapTourismToFoodSpot } from "@/lib/tourism-mapper";
import { looksLikeCafe } from "@/lib/utils";

export async function GET() {
  try {
    const items = await getFoodList();
    const spots = items
      .filter((item) => item.mapx && item.mapy && parseFloat(item.mapx) !== 0)
      .filter((item) => !looksLikeCafe(item.title))
      .map(mapTourismToFoodSpot);
    return NextResponse.json({ spots });
  } catch {
    return NextResponse.json({ spots: [] });
  }
}
