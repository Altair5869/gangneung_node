import { NextRequest, NextResponse } from "next/server";

interface DirectionsPoint {
  lat: number;
  lng: number;
}

interface KakaoDirectionsResponse {
  routes: {
    result_code: number;
    sections: {
      roads: { vertexes: number[] }[];
    }[];
  }[];
}

export async function POST(request: NextRequest) {
  const { points } = (await request.json()) as { points: DirectionsPoint[] };

  if (!points || points.length < 2) {
    return NextResponse.json({ path: [] });
  }

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return NextResponse.json({ path: [] });

  const origin = `${points[0].lng},${points[0].lat}`;
  const destination = `${points[points.length - 1].lng},${points[points.length - 1].lat}`;
  const waypoints = points
    .slice(1, -1)
    .map((p) => `${p.lng},${p.lat}`)
    .join("|");

  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  if (waypoints) url.searchParams.set("waypoints", waypoints);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${key}` },
    });
    if (!res.ok) return NextResponse.json({ path: [] });

    const data = (await res.json()) as KakaoDirectionsResponse;
    const route = data.routes?.[0];
    if (!route || route.result_code !== 0) return NextResponse.json({ path: [] });

    const path: DirectionsPoint[] = [];
    for (const section of route.sections) {
      for (const road of section.roads) {
        const v = road.vertexes;
        for (let i = 0; i < v.length; i += 2) {
          path.push({ lng: v[i], lat: v[i + 1] });
        }
      }
    }
    return NextResponse.json({ path });
  } catch {
    return NextResponse.json({ path: [] });
  }
}
