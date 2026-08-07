import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// KST(UTC+9) 기준 오늘 날짜를 YYYYMMDD 문자열로 반환한다. 원래 lib/tourism-api.ts에만 있던
// 함수를 여기로 옮겼다(옵션 B, 2026-08-07) — getEventList()의 eventStartDate 파라미터뿐 아니라
// lib/ai.ts의 validateRoute(이벤트 날짜 검증, event-date 체크)도 같은 로직이 필요한데, lib/ai.ts는
// 관광공사 API 모듈(lib/tourism-api.ts)을 직접 import하지 않는 기존 아키텍처 원칙이 있다. 순수
// 날짜 유틸이라 이 공유 위치로 옮기고 두 곳(lib/tourism-api.ts, lib/ai.ts)에서 재사용한다 — 로직
// 복제 금지, 원본은 이 함수 하나만 유지.
export function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function noiseLabel(noise: "언급됨-조용함" | "언급됨-시끄러움" | "언급없음") {
  if (noise === "언급없음") return "소음 미확인";
  return { "언급됨-조용함": "조용함 언급", "언급됨-시끄러움": "시끄러움 언급" }[noise];
}

export function powerLabel(level: "충분함" | "제한적" | "없음" | null) {
  if (level === null) return "콘센트 미확인";
  return { "충분함": "콘센트 충분", "제한적": "콘센트 적음", "없음": "콘센트 없음" }[level];
}

export function wifiLabel(available: boolean | null) {
  if (available === null) return "WiFi 미확인";
  return available ? "WiFi 있음" : "WiFi 없음";
}

export function congestionLabel(level?: "low" | "medium" | "high") {
  if (!level) return "정보 없음";
  return { low: "여유", medium: "보통", high: "혼잡" }[level];
}

// barrierFree 필드가 존재한다고 해서 무장애인 건 아니다 (wheelchair: false인 채로도 객체는 존재할 수 있음).
// 관광공사 무장애 API의 wheelchair 필드는 "휠체어 대여 서비스" 여부라 실제로는 거의 항상 비어있다.
// 출입구 단차/자동문/경사로 등 실제 접근성 정보는 exit 필드에 들어있으므로 이걸 기준으로 판단한다.
export function isBarrierFree(barrierFree?: { exit?: boolean }) {
  return barrierFree?.exit === true;
}

// 관광공사 API는 카페/베이커리도 "음식점"(contentTypeId 39) 하나로 묶어서 준다.
// 같은 곳이 워크스팟(카페)과 식당 목록 양쪽에 동일 contentId로 중복 노출되는 걸 막기 위해 사용.
const CAFE_KEYWORDS = ["카페", "커피", "coffee", "cafe", "베이커리", "브루어리", "빵집", "제과"];

export function looksLikeCafe(name: string): boolean {
  const lower = name.toLowerCase();
  return CAFE_KEYWORDS.some((kw) => lower.includes(kw));
}

// 시간대·요일 기반 예상 혼잡도 (장소 ID로 분산 적용)
export function estimateCongestion(spotId: string, now = new Date()): "low" | "medium" | "high" {
  const hour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  let base: number; // 0=low 1=medium 2=high
  if (isWeekend) {
    if (hour < 10) base = 0;
    else if (hour < 12) base = 1;
    else if (hour < 18) base = 2;
    else if (hour < 21) base = 1;
    else base = 0;
  } else {
    if (hour < 9) base = 0;
    else if (hour < 12) base = 0;
    else if (hour < 14) base = 1;
    else if (hour < 17) base = 1;
    else if (hour < 20) base = 2;
    else base = 0;
  }

  // 장소마다 다른 혼잡도를 주기 위한 결정론적 오프셋 (-1 / 0 / +1)
  const hash = spotId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const offset = (hash % 3) - 1;
  const level = Math.max(0, Math.min(2, base + offset));
  return (["low", "medium", "high"] as const)[level];
}
