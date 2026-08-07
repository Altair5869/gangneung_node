import { WorkSpot, LifeSpot } from "@/types";

export const categoryLabel: Record<WorkSpot["category"] | LifeSpot["category"], string> = {
  cafe: "카페",
  coworking: "코워킹",
  library: "도서관",
  hotel: "호텔",
  other: "기타",
  attraction: "관광지",
  stay: "숙박",
  food: "음식점",
  event: "행사/축제",
};

export const categoryGradient: Record<WorkSpot["category"], string> = {
  cafe: "from-accent to-accent/70",
  coworking: "from-primary to-primary/70",
  library: "from-primary-dark to-primary",
  hotel: "from-hero-glow to-primary/60",
  other: "from-border to-muted",
};

export const noiseBadge: Record<"언급됨-조용함" | "언급됨-시끄러움", string> = {
  "언급됨-조용함": "bg-good/15 text-good",
  "언급됨-시끄러움": "bg-bad/15 text-bad",
};

export const powerBadge: Record<"충분함" | "제한적" | "없음", string> = {
  "충분함": "bg-good/15 text-good",
  "제한적": "bg-warn/15 text-warn",
  "없음": "bg-bad/15 text-bad",
};

export const congestionStyle: Record<"low" | "medium" | "high", { dot: string; text: string }> = {
  low: { dot: "bg-good", text: "text-good" },
  medium: { dot: "bg-warn", text: "text-warn" },
  high: { dot: "bg-bad", text: "text-bad" },
};

// /spots/[id]와 AI 큐레이터 결과 카드(RouteVerificationCard)가 barrierFree 5개 필드 라벨을
// 각자 하드코딩하면 한쪽만 라벨이 바뀌거나 순서가 어긋나는 사고가 재발한다 — 이 프로젝트에
// 실제로 있었던 재발 이력(lib/verified-spots.ts:9, 2026-07-28 barrierFree 병합 버그)과 같은
// 유형이라, 두 화면이 이 배열 하나를 공유한다(옵션 I R6, 2026-08-06).
// wheelchair는 "휠체어 대여 서비스" 여부이지 "휠체어 접근성"이 아니므로(lib/utils.ts의
// isBarrierFree 주석 근거) 라벨을 "대여" 이외의 접근성 암시 문구로 절대 바꾸지 않는다.
export const BARRIER_FREE_FIELDS: { key: keyof NonNullable<WorkSpot["barrierFree"]>; label: string }[] = [
  { key: "wheelchair", label: "휠체어 대여" },
  { key: "elevator", label: "엘리베이터" },
  { key: "restroom", label: "장애인 화장실" },
  { key: "parking", label: "장애인 주차" },
  { key: "exit", label: "출입 가능" },
];
