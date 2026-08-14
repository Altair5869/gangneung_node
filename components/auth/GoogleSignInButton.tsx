"use client";

import { signIn } from "next-auth/react";

// components/AuthButton.tsx의 기존 Google 버튼과 완전히 동일한 signIn("google") 호출이다
// (요구사항 문서 1번 "기존 Google 로그인 동작 변경 금지") — /login 페이지에서 이메일/비밀번호와
// 나란히 선택할 수 있도록 별도 컴포넌트로 둔 것뿐, 동작 자체는 그대로다.
export default function GoogleSignInButton() {
  return (
    <button
      onClick={() => signIn("google")}
      className="w-full text-center border border-border rounded-2xl py-3 text-sm font-semibold text-foreground/80 hover:bg-muted transition-colors"
    >
      Google로 로그인
    </button>
  );
}
