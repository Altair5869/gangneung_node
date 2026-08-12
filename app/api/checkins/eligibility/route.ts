import { NextRequest, NextResponse } from "next/server";
import { getSpotById } from "@/lib/spot-detail";
import { calculateHaversineDistance } from "@/lib/ai";
import { CHECKIN_RADIUS_M } from "@/lib/community-checkin";

// R2-2/R2-3 UI 요구사항("반경 밖이면 체크인하기 버튼이 비활성화되고 사유가 표시된다")을
// POST 이전에 미리 보여주기 위한 보조 엔드포인트. R5 목록에는 없던 추가 파일이지만, 실제 반경
// 검증(권위 있는 판정)은 여전히 POST /api/checkins가 제출 시점에 동일한
// calculateHaversineDistance로 다시 수행한다 — 이 GET은 UI 힌트일 뿐 보안 경계가 아니다.
// (클라이언트 컴포넌트가 lib/ai.ts를 직접 import하면 Anthropic SDK 등 서버 전용 모듈이 브라우저
// 번들에 섞여 들어가 process.env 참조가 깨진다 — 그래서 거리 계산은 항상 이 서버 라우트를
// 거치게 하고, 클라이언트에서 Math.hypot 등으로 다시 계산하지 않는다.)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const spotId = searchParams.get("spotId");
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!spotId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const spot = await getSpotById(spotId);
  if (!spot) {
    return NextResponse.json({ error: "스팟을 찾을 수 없습니다" }, { status: 404 });
  }

  const distanceM = calculateHaversineDistance(lat, lng, spot.lat, spot.lng) * 1000;
  return NextResponse.json({
    withinRadius: distanceM <= CHECKIN_RADIUS_M,
    distanceM: Math.round(distanceM),
    radiusM: CHECKIN_RADIUS_M,
  });
}
