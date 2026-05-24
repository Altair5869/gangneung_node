export interface WorkSpot {
  id: string;
  name: string;
  category: "cafe" | "coworking" | "library" | "hotel" | "other";
  address: string;
  lat: number;
  lng: number;
  wifi: {
    available: boolean;
    speedMbps?: number;
  };
  power: {
    available: boolean;
    outlets?: number;
  };
  noise: "quiet" | "moderate" | "noisy";
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
}

export interface CurationRoute {
  spots: WorkSpot[];
  totalDuration: number;
  description: string;
  tips: string[];
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
