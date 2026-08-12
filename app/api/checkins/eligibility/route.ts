import { NextRequest, NextResponse } from "next/server";
import { getSpotById } from "@/lib/spot-detail";
import { calculateHaversineDistance } from "@/lib/ai";
import { CHECKIN_RADIUS_M, checkEligibilityRateLimit } from "@/lib/community-checkin";

// R2-2/R2-3 UI 요구사항("반경 밖이면 체크인하기 버튼이 비활성화되고 사유가 표시된다")을
// POST 이전에 미리 보여주기 위한 보조 엔드포인트. R5 목록에는 없던 추가 파일이지만, 실제 반경
// 검증(권위 있는 판정)은 여전히 POST /api/checkins가 제출 시점에 동일한
// calculateHaversineDistance로 다시 수행한다 — 이 GET은 UI 힌트일 뿐 보안 경계가 아니다.
// (클라이언트 컴포넌트가 lib/ai.ts를 직접 import하면 Anthropic SDK 등 서버 전용 모듈이 브라우저
// 번들에 섞여 들어가 process.env 참조가 깨진다 — 그래서 거리 계산은 항상 이 서버 라우트를
// 거치게 하고, 클라이언트에서 Math.hypot 등으로 다시 계산하지 않는다.)
//
// 인증 없이(비로그인 상태에서도) 호출 가능해야 하므로 POST /api/checkins의 계정(userId) 기준
// 레이트리밋을 재사용할 수 없다 — IP 기준으로 어뷰징/비용(getSpotById 호출)을 방어한다.
// NextRequest.ip/geo는 Next.js 15.0.0부터 제거됐다(node_modules/next/dist/docs/01-app/
// 03-api-reference/04-functions/next-request.md의 Version History에서 확인) — 대신 헤더에서
// 클라이언트 IP를 읽는다.
//
// 신뢰 경계 (중요, QA에서 헤더 스푸핑으로 레이트리밋 우회가 발견됨 — 커밋 39c330c 이후 강화):
// - `x-forwarded-for`는 클라이언트가 요청에 직접 실어 보낼 수 있는 일반 헤더라서 그 값을 그대로
//   믿으면 임의 문자열로 레이트리밋을 우회당한다.
// - `x-vercel-forwarded-for`는 Vercel의 엣지 프록시가 클라이언트가 보낸 값을 무시하고 실제 접속
//   IP로 덮어써서 설정하는 헤더다. **Vercel에 배포된 환경에서만** 신뢰할 수 있다.
// - 로컬 개발(`npm run dev`)에는 이 프록시가 없으므로 `x-vercel-forwarded-for` 자체가 존재하지
//   않는다. 그래서 개발 편의상 `x-forwarded-for` → `x-real-ip`로 폴백하지만, 로컬/비Vercel
//   환경에서는 이 폴백 값도 여전히 스푸핑 가능하다 — 완전한 방어가 아니라 개발 편의를 위한
//   타협이다. Vercel 이외의 환경에 배포한다면 그 인프라가 신뢰할 수 있는 별도 헤더로 교체해야 한다.
function getClientIp(request: NextRequest): string {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return vercelForwardedFor.trim();
  }
  // 로컬 개발 폴백. 프록시 체인을 신뢰하지 않으므로 정교한 파싱은 하지 않고 첫 값만 취한다.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const spotId = searchParams.get("spotId");
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!spotId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const rate = await checkEligibilityRateLimit(getClientIp(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.reason, retryAfterSeconds: rate.retryAfterSeconds },
      {
        status: 429,
        headers: rate.retryAfterSeconds != null ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined,
      }
    );
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
