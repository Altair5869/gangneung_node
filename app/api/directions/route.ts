import { NextRequest, NextResponse } from "next/server";

interface DirectionsPoint {
  lat: number;
  lng: number;
}

interface KakaoDirectionsResponse {
  routes: {
    result_code: number;
    summary?: {
      distance?: number;
      duration?: number;
    };
    sections: {
      distance?: number;
      duration?: number;
      roads: { vertexes: number[] }[];
    }[];
  }[];
}

// 도로 기준 총 거리/시간(참고 정보용, 옵션 E-2/R6). 실측(2026-08-10, 실제 카카오모빌리티 키로
// 좌표 4점 호출) 결과 route.summary.distance/duration(m/s)과 route.sections[].distance/duration이
// 둘 다 응답에 존재하는 것을 확인했다 — 다만 이 라우트는 지도 카드의 "총합" 참고 정보(R6 요구사항
// 3)만 필요해서 summary만 응답에 싣는다. sections는 leg별 상세가 필요해질 때 추가한다.
interface DirectionsApiResponse {
  path: DirectionsPoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
}

const EMPTY_RESPONSE: DirectionsApiResponse = { path: [], distanceMeters: null, durationSeconds: null };

export async function POST(request: NextRequest) {
  const { points } = (await request.json()) as { points: DirectionsPoint[] };

  if (!points || points.length < 2) {
    return NextResponse.json(EMPTY_RESPONSE);
  }

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return NextResponse.json(EMPTY_RESPONSE);

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
    if (!res.ok) return NextResponse.json(EMPTY_RESPONSE);

    const data = (await res.json()) as KakaoDirectionsResponse;
    const route = data.routes?.[0];
    if (!route || route.result_code !== 0) return NextResponse.json(EMPTY_RESPONSE);

    const path: DirectionsPoint[] = [];
    for (const section of route.sections) {
      for (const road of section.roads) {
        const v = road.vertexes;
        for (let i = 0; i < v.length; i += 2) {
          path.push({ lng: v[i], lat: v[i + 1] });
        }
      }
    }

    const distanceMeters = typeof route.summary?.distance === "number" ? route.summary.distance : null;
    const durationSeconds = typeof route.summary?.duration === "number" ? route.summary.duration : null;

    return NextResponse.json({ path, distanceMeters, durationSeconds });
  } catch {
    return NextResponse.json(EMPTY_RESPONSE);
  }
}
