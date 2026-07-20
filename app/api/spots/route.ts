import { NextRequest, NextResponse } from "next/server";
import { buildSpotCorpus } from "@/lib/spot-corpus";
import { isBarrierFree } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const noise = searchParams.get("noise");
  const wifi = searchParams.get("wifi");
  const power = searchParams.get("power");
  const barrierFree = searchParams.get("barrierFree");
  const startHourParam = searchParams.get("startHour");

  // 방문 예정 시간이 주어지면 "지금 이 순간"이 아니라 그 시간대 기준으로 혼잡도를 추정한다.
  let plannedTime: Date | undefined;
  if (startHourParam !== null) {
    const hour = Number(startHourParam);
    if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
      plannedTime = new Date();
      plannedTime.setHours(hour, 0, 0, 0);
    }
  }

  let spots = await buildSpotCorpus(plannedTime);

  if (noise) spots = spots.filter((s) => s.noise === noise);
  if (wifi === "true") spots = spots.filter((s) => s.wifi.available);
  if (power === "true") spots = spots.filter((s) => s.power.level === "충분함" || s.power.level === "제한적");
  if (barrierFree === "true") spots = spots.filter((s) => isBarrierFree(s.barrierFree));

  return NextResponse.json({ spots });
}
