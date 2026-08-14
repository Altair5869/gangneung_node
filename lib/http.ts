// app/api/checkins/eligibility/route.ts에 있던 getClientIp를 공통 유틸로 추출했다(요구사항
// 문서 "회원가입/로그인 요구사항 7번" — auth.ts의 Credentials.authorize()도 동일한 IP 추출
// 로직이 필요해서 중복 구현하지 않고 여기 하나로 공유한다). 로직 자체는 원본과 동일 —
// 아래 신뢰 경계 주석도 원본 그대로 유지.
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
//
// 매개변수 타입을 NextRequest가 아니라 표준 Request로 잡은 이유: NextAuth Credentials
// provider의 authorize(credentials, request)가 넘겨주는 request는 NextRequest가 아니라
// 표준 Request 객체다(@auth/core/providers/credentials.d.ts 확인). NextRequest는 Request의
// 서브타입이라 이 함수를 두 호출부(Route Handler의 NextRequest, authorize의 Request) 모두에서
// 그대로 재사용할 수 있다.
export function getClientIp(request: Request): string {
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
