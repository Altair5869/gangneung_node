import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/http";
import { checkSignupRateLimit, createUser, isValidEmail, isValidPassword, PASSWORD_MIN_LENGTH } from "@/lib/user-auth";

// Credentials provider의 authorize()는 로그인만 처리하고(NextAuth 표준), 계정 생성은 별도
// 라우트가 필요하다(요구사항 문서 "영향 범위" — POST /api/auth/signup 하나만 추가하면 충분하다는
// 예상이 실제로 맞음). bcryptjs를 쓰므로 app/api/auth/[...nextauth]/route.ts와 동일하게
// runtime="nodejs"를 명시한다.
export const runtime = "nodejs";

interface SignupBody {
  email: string;
  password: string;
  passwordConfirm: string;
}

function isValidBody(v: unknown): v is SignupBody {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.email === "string" &&
    typeof b.password === "string" &&
    typeof b.passwordConfirm === "string"
  );
}

// R: 이메일/비밀번호 회원가입 제출. 인증 메일 발송 없음(스코프 제외, 2026-08-14 축소안 확정) —
// 이메일 형식만 검증하고 즉시 계정을 생성한다. 비밀번호 재설정 기능도 이 라운드에 없다.
export async function POST(request: NextRequest) {
  // 이메일 중복 응답도 레이트리밋 대상(보안 체크리스트 5번) — createUser 분기보다 먼저 걸어서
  // email_taken 응답을 포함한 이 라우트의 모든 응답이 동일하게 제한받는다.
  const rate = await checkSignupRateLimit(getClientIp(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.reason, retryAfterSeconds: rate.retryAfterSeconds },
      {
        status: 429,
        headers: rate.retryAfterSeconds != null ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined,
      }
    );
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

  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "올바른 이메일 형식이 아닙니다" }, { status: 400 });
  }
  if (!isValidPassword(body.password)) {
    return NextResponse.json(
      { error: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다` },
      { status: 400 }
    );
  }
  // 서버 측 재검증(요구사항 문서 8번) — 클라이언트(SignupForm)에서 이미 확인 일치를 검사하지만
  // 클라이언트 검증만으로는 우회 가능하므로 여기서도 다시 확인한다.
  if (body.password !== body.passwordConfirm) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다" }, { status: 400 });
  }

  const result = await createUser(body.email, body.password);
  if (!result.ok) {
    if (result.reason === "email_taken") {
      return NextResponse.json({ error: "이미 가입된 이메일입니다" }, { status: 409 });
    }
    // invalid_email/invalid_password는 위에서 이미 걸러졌지만 createUser 내부에서 다시
    // 검증하므로(방어적 이중 체크) 이론상 도달 시 동일한 메시지로 응답한다.
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
