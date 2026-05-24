import { NextRequest, NextResponse } from "next/server";
import { curateRoute } from "@/lib/ai";
import { CurationRequest, WorkSpot } from "@/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    curationRequest: CurationRequest;
    spots: WorkSpot[];
  };

  const route = await curateRoute(body.curationRequest, body.spots);
  return NextResponse.json({ route });
}
