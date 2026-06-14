import { NextResponse } from "next/server";
import { getAttractionList } from "@/lib/tourism-api";
import { mapTourismToLifeSpot } from "@/lib/tourism-mapper";

export async function GET() {
  try {
    const items = await getAttractionList();
    const spots = items
      .filter((item) => item.mapx && item.mapy && parseFloat(item.mapx) !== 0)
      .map(mapTourismToLifeSpot);
    return NextResponse.json({ spots });
  } catch {
    return NextResponse.json({ spots: [] });
  }
}
