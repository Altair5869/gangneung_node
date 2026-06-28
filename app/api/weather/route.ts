import { NextResponse } from "next/server";
import { getGangneungWeather } from "@/lib/weather-api";

export async function GET() {
  const weather = await getGangneungWeather();
  return NextResponse.json(weather ?? { error: "날씨 데이터 없음" });
}
