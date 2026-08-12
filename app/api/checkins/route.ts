import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSpotById } from "@/lib/spot-detail";
import { calculateHaversineDistance } from "@/lib/ai";
import { CHECKIN_RADIUS_M, checkCheckinRateLimit, submitCheckin } from "@/lib/community-checkin";

interface CheckinRequestBody {
  spotId: string;
  wifiAvailable: boolean;
  powerLevel: "충분함" | "제한적" | "없음";
  lat: number;
  lng: number;
}

function isValidBody(v: unknown): v is CheckinRequestBody {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.spotId === "string" &&
    b.spotId.length > 0 &&
    typeof b.wifiAvailable === "boolean" &&
    (b.powerLevel === "충분함" || b.powerLevel === "제한적" || b.powerLevel === "없음") &&
    typeof b.lat === "number" &&
    Number.isFinite(b.lat) &&
    typeof b.lng === "number" &&
    Number.isFinite(b.lng)
  );
}

// R2: 체크인 제출(신규/갱신 겸용, upsert). 자유 텍스트/speedMbps 입력은 애초에 이 요청 바디에
// 존재하지 않는다(데이터 규칙 2). 위치 권한 거부·Geolocation 실패는 클라이언트가 lat/lng을
// 아예 보내지 못하므로 isValidBody에서 자동으로 걸러진다(R2-3).
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const spot = await getSpotById(body.spotId);
  if (!spot) {
    return NextResponse.json({ error: "스팟을 찾을 수 없습니다" }, { status: 404 });
  }

  // R2-2: 하버사인 거리 계산은 lib/ai.ts의 calculateHaversineDistance를 그대로 재사용한다
  // (Math.hypot 등으로 새로 계산하지 않음 — 위경도 1도의 실제 길이가 달라 순서/거리가 어긋난다).
  const distanceM = calculateHaversineDistance(body.lat, body.lng, spot.lat, spot.lng) * 1000;
  if (distanceM > CHECKIN_RADIUS_M) {
    return NextResponse.json(
      { error: `스팟 근처(${CHECKIN_RADIUS_M}m 이내)에서만 체크인할 수 있어요`, distanceM: Math.round(distanceM) },
      { status: 403 }
    );
  }

  try {
    const rate = await checkCheckinRateLimit(userId, body.spotId);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.reason, retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429 }
      );
    }

    await submitCheckin({
      spotId: body.spotId,
      userId,
      wifiAvailable: body.wifiAvailable,
      powerLevel: body.powerLevel,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/checkins] 체크인 처리 실패:", error);
    return NextResponse.json({ error: "일시적인 오류로 체크인에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
