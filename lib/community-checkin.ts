import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { CheckinAggregate, CheckinRecord, CommunityCheckinSummary } from "@/types";
import { wilsonLowerBound } from "@/lib/wilson-score";

// R3-4: 매직 넘버 금지, 이름 붙여 상수로 선언.
export const WIFI_CONFIRM_THRESHOLD = 0.6;
export const POWER_MIN_SAMPLE = 3;
export const POWER_MODAL_SHARE_THRESHOLD = 0.5;
export const CHECKIN_RADIUS_M = 100;

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 자동 인식

// R4-1/R4-2 키 스키마
const recordKey = (spotId: string, userId: string) => `checkin:${spotId}:${userId}`;
const aggKey = (spotId: string) => `checkin:agg:${spotId}`;

type PowerLevel = "충분함" | "제한적" | "없음";
const POWER_LEVELS: readonly PowerLevel[] = ["충분함", "제한적", "없음"];
const powerField = (level: PowerLevel) => `power:${level}`;

interface RawAggregate {
  wifiYes?: string | number;
  wifiNo?: string | number;
  totalCheckins?: string | number;
  "power:충분함"?: string | number;
  "power:제한적"?: string | number;
  "power:없음"?: string | number;
  // @upstash/redis의 hgetall<TData extends Record<string, unknown>>() 제약을 만족시키기 위한
  // 인덱스 시그니처. 실제로 이 필드 외의 키는 쓰지 않는다.
  [key: string]: string | number | undefined;
}

function toNonNegativeNumber(v: string | number | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseAggregate(raw: RawAggregate | null): CheckinAggregate {
  return {
    wifiYes: toNonNegativeNumber(raw?.wifiYes),
    wifiNo: toNonNegativeNumber(raw?.wifiNo),
    powerCounts: {
      "충분함": toNonNegativeNumber(raw?.["power:충분함"]),
      "제한적": toNonNegativeNumber(raw?.["power:제한적"]),
      "없음": toNonNegativeNumber(raw?.["power:없음"]),
    },
    totalCheckins: toNonNegativeNumber(raw?.totalCheckins),
  };
}

// 순수 함수(Redis I/O 없음) — CheckinAggregate(누적 카운트)를 받아 신뢰도 승격 판정을 적용한
// CommunityCheckinSummary로 변환한다. 체크인이 0건이면 undefined(필드 자체가 없어야 함, R7-5).
export function summarizeAggregate(agg: CheckinAggregate): CommunityCheckinSummary | undefined {
  if (agg.totalCheckins === 0) return undefined;

  const wifiTotal = agg.wifiYes + agg.wifiNo;
  let confirmedAvailable: boolean | null = null;
  if (wifiTotal > 0) {
    // 사용자 결정(2026-08-11, 요구사항 문서 범위 확장): wifi "없음"도 커뮤니티로 확인되면
    // 대칭 배지를 보여준다. 같은 wilsonLowerBound 함수를 양방향(yes 기준/no 기준)으로 한 번씩
    // 호출한다 — 별도 로직 추가 없음. 둘 다 미달이면 null(정보 부족) 유지.
    const yesLower = wilsonLowerBound(agg.wifiYes, wifiTotal);
    const noLower = wilsonLowerBound(agg.wifiNo, wifiTotal);
    if (yesLower >= WIFI_CONFIRM_THRESHOLD) confirmedAvailable = true;
    else if (noLower >= WIFI_CONFIRM_THRESHOLD) confirmedAvailable = false;
  }

  const powerTotal = agg.powerCounts["충분함"] + agg.powerCounts["제한적"] + agg.powerCounts["없음"];
  let confirmedLevel: PowerLevel | null = null;
  if (powerTotal >= POWER_MIN_SAMPLE) {
    const [modalLevel, modalCount] = POWER_LEVELS.reduce<[PowerLevel, number]>(
      (best, level) => (agg.powerCounts[level] > best[1] ? [level, agg.powerCounts[level]] : best),
      [POWER_LEVELS[0], -1]
    );
    if (modalCount / powerTotal >= POWER_MODAL_SHARE_THRESHOLD) confirmedLevel = modalLevel;
  }

  return {
    totalCheckins: agg.totalCheckins,
    wifi: { yes: agg.wifiYes, no: agg.wifiNo, confirmedAvailable },
    power: { counts: agg.powerCounts, confirmedLevel },
  };
}

// 사용자의 최신 체크인 1건 조회(myCheckin). Redis 장애가 화면 전체를 깨뜨리지 않도록 내부에서
// 흡수하고 null을 반환한다 — 체크인 폼은 "정보 없음"으로 안전하게 폴백한다.
export async function getUserCheckin(spotId: string, userId: string): Promise<CheckinRecord | null> {
  try {
    const record = await redis.get<CheckinRecord>(recordKey(spotId, userId));
    return record ?? null;
  } catch (error) {
    console.error("[community-checkin] getUserCheckin 실패:", error);
    return null;
  }
}

// 단건 스팟의 커뮤니티 요약 조회 (/spots/[id] 상세용).
export async function getCheckinSummary(spotId: string): Promise<CommunityCheckinSummary | undefined> {
  try {
    const raw = await redis.hgetall<RawAggregate>(aggKey(spotId));
    return summarizeAggregate(parseAggregate(raw));
  } catch (error) {
    console.error("[community-checkin] getCheckinSummary 실패:", error);
    return undefined;
  }
}

// 목록 조회(/spots, /api/spots)용 일괄 조회. 스팟 200여 곳에 개별 요청을 보내지 않고 파이프라인
// 1회 왕복으로 처리한다(R5-3, N+1 금지). 실패하면 빈 Map을 반환해 목록 자체는 깨지지 않는다.
export async function getCheckinSummaries(spotIds: string[]): Promise<Map<string, CommunityCheckinSummary>> {
  const result = new Map<string, CommunityCheckinSummary>();
  if (spotIds.length === 0) return result;

  try {
    const pipeline = redis.pipeline();
    spotIds.forEach((id) => pipeline.hgetall(aggKey(id)));
    const rawResults = await pipeline.exec<(RawAggregate | null)[]>();

    spotIds.forEach((id, i) => {
      const summary = summarizeAggregate(parseAggregate(rawResults[i]));
      if (summary) result.set(id, summary);
    });
  } catch (error) {
    console.error("[community-checkin] getCheckinSummaries 실패(파이프라인):", error);
  }
  return result;
}

export interface CheckinInput {
  spotId: string;
  userId: string;
  wifiAvailable: boolean;
  powerLevel: PowerLevel;
}

// 체크인 제출(upsert, R2-4). 이전 체크인이 있으면 그 값을 집계에서 빼고 새 값을 더한다
// (중복 계정 과대표집 방지, append-only 아님) — totalCheckins는 이 경우 변하지 않는다.
// 이전 체크인이 없으면 totalCheckins도 +1. 각 HINCRBY 호출 자체는 원자적이다(R4-2) — 여러
// 필드에 걸친 갱신 전체를 하나의 트랜잭션으로 묶지는 않는다(같은 사용자의 동시 중복 제출 같은
// 드문 경쟁 상태는 이 기능의 스케일(커뮤니티 체크인)에서 감내 가능한 수준으로 판단, 설계 문서
// 범위와 동일).
export async function submitCheckin(input: CheckinInput): Promise<void> {
  const { spotId, userId, wifiAvailable, powerLevel } = input;
  const key = recordKey(spotId, userId);
  const previous = await redis.get<CheckinRecord>(key);

  const pipeline = redis.pipeline();
  const agg = aggKey(spotId);

  if (previous) {
    if (previous.wifiAvailable !== wifiAvailable) {
      pipeline.hincrby(agg, previous.wifiAvailable ? "wifiYes" : "wifiNo", -1);
      pipeline.hincrby(agg, wifiAvailable ? "wifiYes" : "wifiNo", 1);
    }
    if (previous.powerLevel !== powerLevel) {
      pipeline.hincrby(agg, powerField(previous.powerLevel), -1);
      pipeline.hincrby(agg, powerField(powerLevel), 1);
    }
  } else {
    pipeline.hincrby(agg, wifiAvailable ? "wifiYes" : "wifiNo", 1);
    pipeline.hincrby(agg, powerField(powerLevel), 1);
    pipeline.hincrby(agg, "totalCheckins", 1);
  }

  const record: CheckinRecord = { wifiAvailable, powerLevel, submittedAt: new Date().toISOString() };
  pipeline.set(key, record);

  await pipeline.exec();
}

// R2-5: 계정+스팟 조합 24시간에 1회, 계정 기준 1시간에 20회(전체 스팟 합산). 계정 단위를
// 먼저 체크한다 — 순서를 반대로 하면(스팟 단위 먼저) 계정 한도 초과로 결국 거부될 요청이
// 스팟의 24시간 슬롯을 이미 소비해버려, 정작 성공하지 못한 시도 때문에 다음날까지 그 스팟에
// 체크인을 못 하게 되는 부작용이 생긴다.
const perAccountRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  prefix: "ratelimit:checkin:account",
});

const perSpotRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(1, "24 h"),
  prefix: "ratelimit:checkin:spot",
});

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

export async function checkCheckinRateLimit(userId: string, spotId: string): Promise<RateLimitResult> {
  const account = await perAccountRatelimit.limit(userId);
  if (!account.success) {
    return {
      allowed: false,
      reason: "체크인 요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
      retryAfterSeconds: Math.max(0, Math.ceil((account.reset - Date.now()) / 1000)),
    };
  }

  const spot = await perSpotRatelimit.limit(`${userId}:${spotId}`);
  if (!spot.success) {
    return {
      allowed: false,
      reason: "이 스팟은 24시간에 한 번만 체크인할 수 있어요.",
      retryAfterSeconds: Math.max(0, Math.ceil((spot.reset - Date.now()) / 1000)),
    };
  }

  return { allowed: true };
}

// GET /api/checkins/eligibility 전용 레이트리밋. 이 엔드포인트는 로그인 전에도 호출 가능해야
// 하므로(버튼 활성화 여부를 미리 보여줘야 함) 계정 기준(userId)을 쓸 수 없다 — IP 기준으로
// 제한한다. "UI 힌트용, 비용 있는 스팟 조회(getSpotById) 1회"라는 성격을 감안해 계정
// 레이트리밋(20/시간)보다 넉넉하게, 같은 사람이 짧은 시간에 스팟 상세를 여러 번 열람하며
// 위치를 확인하는 상황을 허용한다. 이 라우트는 여전히 보안 경계가 아니다(권위 있는 판정은
// POST /api/checkins) — 어뷰징/비용 방어 목적의 가벼운 제한일 뿐이다.
export const ELIGIBILITY_IP_RATELIMIT_PER_MINUTE = 30;

const eligibilityRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(ELIGIBILITY_IP_RATELIMIT_PER_MINUTE, "1 m"),
  prefix: "ratelimit:checkin:eligibility",
});

export async function checkEligibilityRateLimit(ip: string): Promise<RateLimitResult> {
  const result = await eligibilityRatelimit.limit(ip);
  if (!result.success) {
    return {
      allowed: false,
      reason: "요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
      retryAfterSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
    };
  }
  return { allowed: true };
}
