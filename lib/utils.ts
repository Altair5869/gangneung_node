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

// KST 기준 오늘로부터 days일 후 날짜를 YYYYMMDD로 반환한다. todayKST()와 동일한 UTC+9 오프셋
// 계산을 재사용한다 — app/ai-curator/page.tsx(R7, 방문일 버튼: 내일/모레)와
// app/api/ai/curate/route.ts(R8, 서버 측 visitDate 범위 재검증)가 각자 로직을 복제하지 않고
// 이 함수 하나를 공유한다(옵션 B 후속, 2026-08-11).
export function addDaysKST(days: number): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// 기상청 단기예보(getVilageFcst) 발표 시각표([23,20,17,14,11,08,05,02])를 기준으로 "가장 최근
// 지난 발표 시각"을 역산한다. API 반영까지 약 10분 지연이 있다고 알려져 있어(요구사항 문서
// B절), todayKST()와 동일한 KST 오프셋 트릭에 10분 차감을 더해 적용한 뒤 getUTCHours()로
// KST "시" 값을 읽는다. hour가 0 또는 1이면(자정 경계, 아직 오늘 02시 발표가 반영 안 됨)
// 전날 23시 발표로 넘어간다. now 인자는 기본값 없이 테스트 시 고정 시각을 주입할 수 있게
// 열어둔다(AC2 경계 케이스 3종 검증용, scripts/test-weather-basetime.mjs).
const WEATHER_ANNOUNCE_HOURS = [23, 20, 17, 14, 11, 8, 5, 2];

export function computeWeatherBaseDateTime(now: Date = new Date()): { baseDate: string; baseTime: string } {
  const effective = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 10 * 60 * 1000);
  const hour = effective.getUTCHours();
  const y = effective.getUTCFullYear();
  const m = String(effective.getUTCMonth() + 1).padStart(2, "0");
  const d = String(effective.getUTCDate()).padStart(2, "0");

  const found = WEATHER_ANNOUNCE_HOURS.find((t) => hour >= t);
  if (found !== undefined) {
    return { baseDate: `${y}${m}${d}`, baseTime: `${String(found).padStart(2, "0")}00` };
  }

  // hour가 0 또는 1인 자정 경계 — 오늘 02시 발표가 아직 반영되지 않았으므로 전날 23시 발표를 쓴다.
  const prev = new Date(effective.getTime() - 24 * 60 * 60 * 1000);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return { baseDate: `${py}${pm}${pd}`, baseTime: "2300" };
}

// KST 기준 현재 시각을 "YYYYMMDDHHmm"(12자리) 형태로 반환한다. 날씨 슬롯(fcstDate+fcstTime,
// 마찬가지로 8자리+4자리=12자리) 중 "지금 이후" 슬롯을 문자열 비교만으로 골라내는 데 쓴다
// (MapLifeSpotCard.tsx). todayKST()와 같은 UTC+9 오프셋 트릭이지만 분 단위까지 필요해 별도로 둔다.
export function nowKstTimestamp(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}${m}${d}${hh}${mm}`;
}

// YYYYMMDD 문자열을 "YYYY년 M월 D일" 형태로 표시한다. 원래 app/events/page.tsx에만 있던 로컬
// formatDate였으나, 이번 라운드에서 같은 포맷이 필요한 화면이 늘어나(ai-curator 결과 카드,
// planner 저장 플랜 카드) 공유 위치로 옮겼다(R1, 옵션 B 후속, 2026-08-11) — 로직 복제 금지,
// 원본은 여기 하나만 유지.
export function formatEventDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "";
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6).replace(/^0/, "");
  const d = yyyymmdd.slice(6, 8).replace(/^0/, "");
  return `${y}년 ${m}월 ${d}일`;
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
