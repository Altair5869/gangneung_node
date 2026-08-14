import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { getClientIp } from "@/lib/http";
import { checkLoginRateLimit, verifyUser } from "@/lib/user-auth";

// 이메일/비밀번호 회원가입 요구사항 문서(2026-08-14 축소안) 보안 체크리스트 3번: 로그인
// 레이트리밋 초과 시 이 커스텀 code로 던진다. authorize()가 계정 미존재/비밀번호 틀림일 때
// 반환하는 기본 CredentialsSignin(code: "credentials")과 code가 달라서, 클라이언트가
// "시도가 너무 많음"과 "이메일 또는 비밀번호가 올바르지 않습니다"를 구분해 보여줄 수 있다 —
// 계정 존재 여부를 유출하는 구분이 아니라 요청 빈도에 대한 구분이라 보안 체크리스트 6번과
// 무관하다.
class LoginRateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

// Auth.js v5(next-auth@beta). AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET/AUTH_SECRET는 v5의 AUTH_* 자동
// 추론 관례로 채워지므로 clientId/clientSecret을 수동 전달하지 않는다(요구사항 문서 4-①,
// v4 관례인 NEXTAUTH_SECRET/GOOGLE_CLIENT_ID를 쓰지 않도록 특히 주의). Credentials provider는
// client id/secret이 없어 이 관례와 무관하고, AUTH_SECRET(JWT 서명)만 기존 값을 그대로
// 재사용한다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    // 이메일/비밀번호 회원가입 요구사항 문서 1번: 기존 Google provider의 동작(버튼, 세션 콜백)은
    // 변경하지 않고 Credentials provider만 추가한다.
    Credentials({
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      // authorize()는 app/api/auth/[...nextauth]/route.ts(Route Handler, runtime="nodejs" —
      // App Router 기본값이자 명시적으로 선언함)를 통해서만 호출된다. middleware.ts가 없어 Edge
      // 런타임 경로를 타지 않으므로 bcryptjs(순수 JS 구현) 사용에 제약이 없다.
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        // 로그인은 미인증 상태에서도 시도되므로 계정 식별자를 쓸 수 없다 — IP 기준
        // (checkEligibilityRateLimit과 동일 원칙, getClientIp 재사용).
        const rate = await checkLoginRateLimit(getClientIp(request));
        if (!rate.allowed) {
          throw new LoginRateLimitedError();
        }

        const user = await verifyUser(email, password);
        if (!user) return null; // 계정 미존재/비밀번호 틀림을 구분하지 않고 null(보안 체크리스트 4·6번)

        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" }, // R1-1: 별도 세션 스토어 없이 JWT 세션만 사용
  callbacks: {
    // JWT 세션에서는 session.user에 기본적으로 id가 없다. 체크인 레코드 키
    // (checkin:{spotId}:{userId})와 레이트리밋 식별자가 안정적인 사용자 id를 필요로 하므로,
    // 첫 로그인 때 Auth.js가 채워주는 token.sub(계정 고유 id)를 session.user.id로 노출한다.
    // Credentials provider로 로그인해도 동일하게 동작한다 — @auth/core의 credentials 콜백
    // 처리부(node_modules/@auth/core/lib/actions/callback/index.js)가 authorize()가 반환한
    // user.id를 그대로 token.sub에 채워주므로(sub: user.id), 이 세션 콜백 자체는 변경하지
    // 않아도 된다(요구사항 문서 1번 "세션 콜백 변경 금지"를 그대로 지킬 수 있는 이유).
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
