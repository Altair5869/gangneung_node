import { handlers } from "@/auth";

// Auth.js v5 Route Handler — 얇은 래퍼. 실제 설정은 프로젝트 루트 auth.ts에 있다.
//
// 이메일/비밀번호 회원가입 요구사항 문서 보안 체크리스트 1번: Credentials.authorize()가
// bcryptjs(순수 JS 구현)를 쓰므로 Edge 런타임이 아닌 Node.js 런타임에서 돌아야 한다.
// App Router Route Handler는 기본값이 이미 "nodejs"이지만(node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/02-route-segment-config/runtime.md 확인), 암묵적
// 기본값에 의존하지 않고 명시적으로 선언해 향후 실수로 바뀌는 걸 방지한다.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
