"use client";

import { useSession, signIn, signOut } from "next-auth/react";

// R1-2: 로그인 상태에 따라 버튼이 갈린다. 카카오/네이버는 이번 라운드 범위 밖(R1-3)이라
// Google 한 개만 제공한다.
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
    <button
      onClick={() => signIn("google")}
      className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
    >
      로그인
    </button>
  );
}
