"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

// R1-2: 로그인 상태에 따라 버튼이 갈린다. 카카오/네이버는 이번 라운드 범위 밖(R1-3)이라
// Google 한 개만 제공한다.
//
// 이메일/비밀번호 회원가입 요구사항 문서 1번("기존 Google 로그인 동작(버튼) 변경 금지")에 따라
// 아래 Google 버튼의 onClick(signIn("google") 직접 호출)은 그대로 두고, 이메일/비밀번호
// 진입점은 /login으로 이동하는 보조 링크로만 추가했다(2026-08-14).
export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="w-14 h-4" aria-hidden="true" />;
  }

  if (session?.user) {
    return (
      <button
        onClick={() => signOut()}
        className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
        title={session.user.email ?? undefined}
      >
        로그아웃
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => signIn("google")}
        className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
      >
        로그인
      </button>
      <span className="text-foreground/30 text-xs" aria-hidden="true">
        ·
      </span>
      <Link
        href="/login"
        className="text-xs font-medium text-foreground/50 hover:text-foreground transition-colors"
      >
        이메일로 로그인
      </Link>
    </div>
  );
}
