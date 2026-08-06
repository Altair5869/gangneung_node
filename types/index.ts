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

export type CheckStatus = "pass" | "fail" | "skipped";

export interface RouteCheck {
  id:
    | "workspot-count"
    | "food-included"
    | "distance"
    | "power"
    | "barrier-free"
    | "noise"
    | "unverifiable-preference";
  label: string;   // 화면 표기용 (한국어)
  status: CheckStatus;
  detail?: string; // 예: "8.2 / 10 km · 직선 기준"
}

// 워크스팟의 데이터 상태를 "표시용 문구"로 담는다. 값을 새로 만들지 않고 lib/utils의
// wifiLabel/powerLabel/noiseLabel 결과를 그대로 싣는다 (CLAUDE.md 데이터 규칙 1·2·3).
export interface SpotEvidence {
  spotId: string;
  wifi: string;        // wifiLabel() 결과 그대로
  power: string;       // powerLabel() 결과 그대로
  noise: string;       // noiseLabel() 결과 그대로
  barrierFree: string; // "출입 가능 확인" | "정보 없음" — exit 기준 요약(validateRoute와 동일 기준), 하위호환 유지
  // 옵션 I(2026-08-06): wheelchair/elevator/restroom/parking/exit 5개 필드 원본을 가공 없이
  // 그대로 싣는다(WorkSpot.barrierFree 형태 그대로). optional이라 이 필드가 없는 구버전
  // 저장 플랜(localStorage/공유 링크)도 깨지지 않는다 — 없으면 렌더링 쪽에서 spots 배열의
  // WorkSpot.barrierFree로 폴백한다(components/curator/RouteVerificationCard.tsx).
  barrierFreeDetail?: WorkSpot["barrierFree"];
  measured: boolean;   // VERIFIED_SPOTS 24곳 여부
}

export interface RouteVerification {
  checks: RouteCheck[];
  distanceKm: number;         // 하버사인(직선) 값
  distanceThresholdKm: number;
  attempts: number;           // 생성 시도 횟수 (1 = 재시도 없음)
  evidence: SpotEvidence[];   // 워크스팟만 (LifeSpot에는 해당 필드가 없음)
}

export interface CurationRoute {
  spots: RouteStop[];
  totalDuration: number;
  description: string;
  tips: string[];
  validationNote?: string;
  schedule?: string[];
  // optional인 것은 타협이 아니라 필수 요건이다: CurationRoute는 lib/planner-storage.ts가
  // localStorage(wk_plans)에 직렬화하고 encodePlan으로 공유 URL에 싣는다. 이미 저장된
  // 플랜/공유 링크에는 이 필드가 없으므로 필수로 만들면 기존 데이터 렌더링이 깨진다.
  verification?: RouteVerification;
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
  // 관광공사 서비스분류코드(소분류). 목록 API(areaBasedList2/locationBasedList2) 응답에는 항상
  // 들어오지만 detailCommon2 등 일부 응답에는 없을 수 있어 optional로 둔다.
  // 음식점(contentTypeId=39) 하위: A05020100 한식 / A05020200 서양식 / A05020300 일식 /
  // A05020400 중식 / A05020900 카페·전통찻집.
  cat3?: string;
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
  // guidesystem(유도 안내 시스템) 필드는 여기 두지 않는다. 관광공사 무장애 API
  // (KorWithService2/detailWithTour2) 실응답을 2026-08-06 직접 호출해 확인한 결과, 강릉시
  // 지역 관광지 400건(areaBasedList2로 얻은 contentId 전수, 4페이지)의 detailWithTour2
  // 응답에서 guidesystem이 단 1건도 비어있지 않은 값을 반환하지 않았다(0/400) — 같은 표본에서
  // wheelchair는 최소 3건 이상 실제 값이 확인된 것과 대조적으로 사실상 완전히 죽은 필드라
  // 타입에서 제거했다(옵션 I R3 결정). docs/AGENT_DESIGN.md "무장애 세부 필드 노출" 절 참고.
}
