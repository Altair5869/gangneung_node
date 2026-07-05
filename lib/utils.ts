import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function noiseLabel(noise: "quiet" | "moderate" | "noisy" | null) {
  if (!noise) return "소음 미확인";
  return { quiet: "조용함", moderate: "보통", noisy: "시끄러움" }[noise];
}

export function congestionLabel(level?: "low" | "medium" | "high") {
  if (!level) return "정보 없음";
  return { low: "여유", medium: "보통", high: "혼잡" }[level];
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
