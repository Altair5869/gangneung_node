import type { DefaultSession } from "next-auth";

// auth.ts의 session 콜백이 session.user.id를 채워주므로, 타입도 그 계약을 반영한다
// (module augmentation은 Auth.js v5 공식 패턴). 이 id는 checkin:{spotId}:{userId} 키와
// 레이트리밋 식별자(lib/community-checkin.ts)에 쓰인다.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
