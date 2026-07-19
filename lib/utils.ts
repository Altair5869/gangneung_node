import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function noiseLabel(noise: "언급됨-조용함" | "언급됨-시끄러움" | "언급없음") {
  if (noise === "언급없음") return "소음 미확인";
  return { "언급됨-조용함": "조용함 언급", "언급됨-시끄러움": "시끄러움 언급" }[noise];
}

export function powerLabel(level: "충분함" | "제한적" | "없음" | null) {
  if (level === null) return "콘센트 미확인";
  return { "충분함": "콘센트 충분", "제한적": "콘센트 적음", "없음": "콘센트 없음" }[level];
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
