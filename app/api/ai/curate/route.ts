import { NextRequest, NextResponse } from "next/server";
import { curateRoute } from "@/lib/ai";
import { CurationRequest, WorkSpot, LifeSpot } from "@/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    curationRequest: CurationRequest;
    spots: WorkSpot[];
    lifeSpots: LifeSpot[];
  };

  const route = await curateRoute(body.curationRequest, body.spots, body.lifeSpots ?? []);
  return NextResponse.json({ route });
}
