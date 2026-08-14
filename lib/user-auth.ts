import { randomUUID } from "crypto";
import { compare, hash, hashSync } from "bcryptjs";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// 이메일/비밀번호 회원가입(요구사항 문서, 2026-08-14 축소안 — 이메일 인증 발송 없음, 비밀번호
// 재설정 없음). lib/community-checkin.ts의 Redis 키 스킴·try/catch·레이트리밋 패턴을 그대로
// 따른다.
//
// userId 네임스페이스 충돌 방지(요구사항 문서 보안 체크리스트 6번, developer 역기록):
// Google provider는 token.sub로 Google 계정 고유 숫자 문자열(예: "10769150...")을 쓴다.
// Credentials 계정 id는 `cred_<uuid>` 접두어를 붙여 발급한다 — "UUID 자체 충돌 확률이
// 사실상 0" 이라는 대안(접두어 생략)도 검토했지만, 접두어를 붙이는 비용이 사실상 0에 가깝고
// (문자열 슬라이스 한 번) checkin:{spotId}:{userId} 같은 키에 Google numeric id와 절대
// 겹치지 않는다는 걸 값만 보고 즉시 알 수 있다는 이점이 있어 접두어 방식을 채택했다.
const CRED_ID_PREFIX = "cred_";

// 요구사항 문서 보안 체크리스트 1번: bcrypt 계열, cost factor 10 이상. OWASP 권장 범위(10~12)
// 상단인 12를 채택 — Credentials.authorize()는 Route Handler(app/api/auth/[...nextauth]/
// route.ts, runtime="nodejs")에서만 실행되므로 Edge 런타임 시간 제한과 무관하고, 로그인은
// 사용자당 드문 빈도라 12 라운드의 CPU 비용이 감내 가능하다고 판단.
const BCRYPT_COST_FACTOR = 12;

// 요구사항 문서 보안 체크리스트 2번: 최소 길이 8자 이상(developer 확정, 이 문서에 역기록).
// 클라이언트(SignupForm)와 서버(이 함수, app/api/auth/signup/route.ts) 양쪽에서 검증한다 —
// 클라이언트 검증만으로는 우회 가능하므로 서버 검증이 최종 권위다.
export const PASSWORD_MIN_LENGTH = 8;

// 타이밍 공격/계정 존재 유출 방지(요구사항 문서 보안 체크리스트 4번): 이메일이 존재하지 않을
// 때도 이 더미 해시를 상대로 bcrypt.compare를 실행해서, "이메일 없음" 경로와 "이메일은 있지만
// 비밀번호 틀림" 경로의 응답 시간을 비슷하게 맞춘다. 실제 사용자 비밀번호가 아니라 모듈 로드
// 시점에 고정된 무작위 문자열의 해시일 뿐이다.
const DUMMY_HASH = hashSync("dummy-password-for-timing-safety-only", BCRYPT_COST_FACTOR);

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 자동 인식

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// 요구사항 문서 보안 체크리스트 7번: lib/community-checkin.ts의 checkin:*/ratelimit:checkin:*
// 네이밍을 참고해 user:{email} 형태로 확장.
const userKey = (email: string) => `user:${normalizeEmail(email)}`;

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

// RFC 5322 전체를 구현하지 않는다 — 이 프로젝트의 다른 검증(예: lib/tourism-mapper.ts)과 같은
// 원칙으로, "형식이 명백히 틀린 값"만 걸러내는 실용적 정규식이면 충분하다.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return typeof email === "string" && EMAIL_RE.test(email);
}

export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH;
}

export type SignupResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_email" | "invalid_password" | "email_taken" };

// 회원가입(요구사항 문서 2·3·5번). 이메일 중복이면 기존 레코드를 덮어쓰지 않고 email_taken을
// 반환한다(완료 기준 "기존 계정 데이터가 덮어써지지 않는다"). 동시 요청 경쟁 상태(TOCTOU, 같은
// 이메일로 정확히 동시에 두 번 가입 시도)는 이 기능 스케일에서 감내 가능한 수준으로 판단한다
// (lib/community-checkin.ts의 submitCheckin과 동일한 원칙 — 완벽한 원자성보다 단순함 우선).
export async function createUser(email: string, password: string): Promise<SignupResult> {
  if (!isValidEmail(email)) return { ok: false, reason: "invalid_email" };
  if (!isValidPassword(password)) return { ok: false, reason: "invalid_password" };

  const key = userKey(email);
  const existing = await redis.get<UserRecord>(key);
  if (existing) return { ok: false, reason: "email_taken" };

  const passwordHash = await hash(password, BCRYPT_COST_FACTOR);
  const record: UserRecord = {
    id: `${CRED_ID_PREFIX}${randomUUID()}`,
    email: normalizeEmail(email),
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await redis.set(key, record);
  return { ok: true, userId: record.id };
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// Credentials.authorize()(auth.ts)에서 호출. 계정 미존재/비밀번호 틀림을 구분하지 않고 항상
// null만 반환한다(요구사항 문서 보안 체크리스트 4번) — 호출부가 동일한 에러 문구
// ("이메일 또는 비밀번호가 올바르지 않습니다")로 통일해서 응답한다. 입력 형식이 아예 틀려도
// 더미 비교를 거쳐 시간 프로파일을 맞춘다.
export async function verifyUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  if (!isValidEmail(email) || typeof password !== "string" || password.length === 0) {
    // 형식이 틀린 입력도 실제 bcrypt.compare 한 번을 거쳐 시간 프로파일을 맞춘다(빈 문자열
    // 비교라도 해시 계산 자체는 동일하게 수행됨).
    await compare(typeof password === "string" ? password : "", DUMMY_HASH);
    return null;
  }

  const record = await redis.get<UserRecord>(userKey(email));
  const hashToCompare = record?.passwordHash ?? DUMMY_HASH;
  const matches = await compare(password, hashToCompare);

  if (!record || !matches) return null;
  return { id: record.id, email: record.email };
}

// 요구사항 문서 보안 체크리스트 3번: 회원가입/로그인 각각 레이트리밋. prefix는 문서 권장대로
// ratelimit:auth:login / ratelimit:auth:signup. 식별자는 lib/community-checkin.ts의
// checkEligibilityRateLimit과 동일하게 IP 기준(app/api/checkins/eligibility/route.ts처럼
// 로그인 전에도 호출되는 엔드포인트라 계정 식별자를 쓸 수 없음, lib/http.ts의 getClientIp 재사용).
const AUTH_LOGIN_RATELIMIT_PER_MINUTE = 10;
const AUTH_SIGNUP_RATELIMIT_PER_HOUR = 5;

const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(AUTH_LOGIN_RATELIMIT_PER_MINUTE, "1 m"),
  prefix: "ratelimit:auth:login",
});

const signupRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(AUTH_SIGNUP_RATELIMIT_PER_HOUR, "1 h"),
  prefix: "ratelimit:auth:signup",
});

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  const result = await loginRatelimit.limit(ip);
  if (!result.success) {
    return {
      allowed: false,
      reason: "로그인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.",
      retryAfterSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
    };
  }
  return { allowed: true };
}

// 이메일 중복 가입 응답도 레이트리밋 대상이어야 한다(요구사항 문서 보안 체크리스트 5번,
// 이메일 존재 여부 대량 스캔 방지) — 이 함수는 createUser 호출 여부와 무관하게 회원가입 라우트
// 진입 시점에 항상 먼저 걸어서, email_taken 응답도 동일하게 제한된다.
export async function checkSignupRateLimit(ip: string): Promise<RateLimitResult> {
  const result = await signupRatelimit.limit(ip);
  if (!result.success) {
    return {
      allowed: false,
      reason: "가입 시도가 너무 많아요. 잠시 후 다시 시도해주세요.",
      retryAfterSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
    };
  }
  return { allowed: true };
}
