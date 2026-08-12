import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Auth.js v5(next-auth@beta). AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET/AUTH_SECRET는 v5의 AUTH_* 자동
// 추론 관례로 채워지므로 clientId/clientSecret을 수동 전달하지 않는다(요구사항 문서 4-①,
// v4 관례인 NEXTAUTH_SECRET/GOOGLE_CLIENT_ID를 쓰지 않도록 특히 주의).
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" }, // R1-1: 별도 세션 스토어 없이 JWT 세션만 사용
  callbacks: {
    // JWT 세션에서는 session.user에 기본적으로 id가 없다. 체크인 레코드 키
    // (checkin:{spotId}:{userId})와 레이트리밋 식별자가 안정적인 사용자 id를 필요로 하므로,
    // 첫 로그인 때 Auth.js가 채워주는 token.sub(계정 고유 id)를 session.user.id로 노출한다.
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
