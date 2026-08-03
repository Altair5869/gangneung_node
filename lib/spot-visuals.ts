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
