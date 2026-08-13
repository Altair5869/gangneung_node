import { NextResponse } from "next/server";
import { buildFoodSpots } from "@/lib/spot-corpus";

export async function GET() {
  try {
    const spots = await buildFoodSpots();
    return NextResponse.json({ spots });
  } catch {
    return NextResponse.json({ spots: [] });
  }
}
