export interface WorkSpot {
  id: string;
  name: string;
  category: "cafe" | "coworking" | "library" | "hotel" | "other";
  address: string;
  lat: number;
  lng: number;
  wifi: {
    available: boolean | null;
    speedMbps?: number;
  };
  power: {
    level: "충분함" | "제한적" | "없음" | null;
  };
  noise: "언급됨-조용함" | "언급됨-시끄러움" | "언급없음";
  openHours: string;
  congestion?: "low" | "medium" | "high";
  imageUrl?: string;
  description?: string;
  tags: string[];
  tourismContentId?: string;
  barrierFree?: {
    wheelchair?: boolean;
    elevator?: boolean;
    restroom?: boolean;
    parking?: boolean;
    exit?: boolean;
  };
}

export interface CurationRequest {
  workStyle: string;
  duration: number;
  preferences: string[];
  startLocation?: string;
  freeText?: string;
  startHour?: number;
}

export interface LifeSpot {
  id: string;
  name: string;
  spotType: "life";
  category: "attraction" | "stay" | "food";
  address: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  description?: string;
  tags: string[];
}

export type RouteStop = WorkSpot | LifeSpot;

export function isLifeSpot(s: RouteStop): s is LifeSpot {
  return "spotType" in s && (s as LifeSpot).spotType === "life";
}

export interface CurationRoute {
  spots: RouteStop[];
  totalDuration: number;
  description: string;
  tips: string[];
  validationNote?: string;
  schedule?: string[];
}

export interface TourismApiItem {
  contentid: string;
  title: string;
  addr1: string;
  addr2?: string;
  mapx: string;
  mapy: string;
  firstimage?: string;
  overview?: string;
}

export interface EventApiItem extends TourismApiItem {
  eventstartdate?: string; // YYYYMMDD
  eventenddate?: string;   // YYYYMMDD
  eventplace?: string;
}

export interface EventSpot {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  startDate: string; // YYYYMMDD
  endDate: string;   // YYYYMMDD
  eventPlace?: string;
  tags: string[];
}

export interface BarrierFreeItem extends TourismApiItem {
  contenttypeid?: string;
  // 무장애 세부 편의시설 정보
  wheelchair?: string;       // 휠체어 대여
  exit?: string;             // 출입 가능 여부
  elevator?: string;         // 엘리베이터
  restroom?: string;         // 장애인 화장실
  parking?: string;          // 장애인 주차
  guidesystem?: string;      // 유도 안내 시스템
}
