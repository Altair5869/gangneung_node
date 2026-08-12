"use client";

import { SessionProvider } from "next-auth/react";

// app/layout.tsx는 metadata export가 필요해 서버 컴포넌트로 남아야 한다(Next.js 규칙상
// metadata는 서버 컴포넌트에서만 export 가능). SessionProvider는 client-only 컨텍스트라
// layout 전체를 client component로 바꾸는 대신, children만 감싸는 이 얇은 wrapper를 둔다.
//
// 의도적으로 session prop을 서버에서 넘기지 않는다: layout에서 auth()를 호출하면(쿠키 의존)
// 이 layout 아래 모든 라우트가 정적 생성에서 완전 동적 렌더링으로 강제 전환된다 — 실측 확인
// 결과 /, /events, /food, /stay(전부 revalidate 윈도우가 있던 ISR 정적 페이지)가 전부 동적(ƒ)
// 으로 바뀌는 광범위한 회귀였다. 로그인 버튼의 짧은 "loading" 깜빡임(하이드레이션 후 클라이언트가
// /api/auth/session을 스스로 fetch하는 동안)은 감내하고, 기존 정적 생성 전략은 그대로 유지한다.
export default function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
