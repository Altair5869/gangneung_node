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
  // 커뮤니티 검증 체크인(2026-08-11 신규): VERIFIED_SPOTS(실측 24곳)와 null(미확인) 사이의
  // 세 번째 신뢰 계층. optional인 이유는 체크인 0건 스팟이 실제로 존재하고, 이 필드가 없는
  // 기존 저장 플랜(localStorage wk_plans)/공유 링크 역직렬화가 깨지면 안 되기 때문이다.
  // 필드명은 CurationRoute.verification(AI 큐레이터 코드 검증 결과)과 의미가 완전히 다르므로
  // "communityVerification"이 아니라 "communityCheckin"을 쓴다(요구사항 문서 4-③).
  communityCheckin?: CommunityCheckinSummary;
}

// checkin:{spotId}:{userId} 에 저장되는 사용자별 최신 체크인 원본(R4-1). 사용자당 스팟당
// 최신 1건만 유지(덮어쓰기) — spotId/userId는 Redis 키에 이미 있으므로 값에는 담지 않는다.
export interface CheckinRecord {
  wifiAvailable: boolean;
  powerLevel: "충분함" | "제한적" | "없음";
  submittedAt: string; // ISO8601
}

// checkin:agg:{spotId} 에 저장되는 스팟별 누적 집계(R4-2, Redis Hash). "가장 최근 상태"가
// 아니라 누적 카운트다 — Wilson score interval 계산에 표본 크기가 필요하기 때문(설계 문서).
export interface CheckinAggregate {
  wifiYes: number;
  wifiNo: number;
  powerCounts: { "충분함": number; "제한적": number; "없음": number };
  totalCheckins: number;
}

// GET /api/spots, GET /api/spots/[id] 응답에 병합되는 커뮤니티 신뢰도 요약(R5). confirmedAvailable/
// confirmedLevel은 반드시 boolean|null / (레벨)|null이다 — Wilson 하한이 임계값 미달이면 무조건
// null(정보 부족)이고, 체크인이 1건이라도 있다고 성급하게 true/false를 채우지 않는다(R6-1, 데이터
// 규칙 1의 취지를 신규 필드에도 동일하게 적용).
export interface CommunityCheckinSummary {
  totalCheckins: number;
  wifi: {
    yes: number;
    no: number;
    confirmedAvailable: boolean | null;
  };
  power: {
    counts: { "충분함": number; "제한적": number; "없음": number };
    confirmedLevel: "충분함" | "제한적" | "없음" | null;
  };
}

// GET /api/checkins/progress 응답(R6, 체크인 챌린지/스탬프 투어 1차). distinctSpotCount는
// checkin:user:{userId}:spots(Redis Set, SADD 멱등)의 SCARD 값 — Wilson score 검증 여부와
// 무관하게 "성공 제출된 체크인"의 distinct 스팟 수만 센다(요구사항 문서 2번). wifi/power/noise
// 필드는 이 판정에 전혀 관여하지 않는다.
export interface CheckinProgress {
  distinctSpotCount: number;
  threshold: number;
  earned: boolean;
}

export interface CurationRequest {
  workStyle: string;
  duration: number;
  preferences: string[];
  startLocation?: string;
  freeText?: string;
  startHour?: number;
  // 옵션 B 후속(2026-08-11): 방문 예정일(YYYYMMDD, eventStartDate/eventEndDate와 동일 포맷).
  // 미지정 시 기존과 완전히 동일하게 "오늘"(todayKST()) 기준으로 동작한다 — 과거 저장된
  // 플랜/공유 링크·직접 API 호출자는 이 필드가 없어도 깨지지 않는다(하위 호환).
  // 값은 서버(app/api/ai/curate/route.ts의 isValidCurationRequest)가 오늘~+2일 범위로
  // 재검증한다 — 클라이언트가 보낸 값을 그대로 신뢰하지 않는다(옵션 K 원칙).
  visitDate?: string;
}

// 강릉시 교통정보 조회서비스(getParkInfo/getParkRltm, data.go.kr 15140011)에서 매칭된
// 주차장 1건. totalLots/availLots는 getParkRltm 응답을 parseInt한 값이라 이론상 null이
// 될 수 있다(파싱 실패 시) — 표시 전용(display-only) 필드이므로 AI 큐레이터 검증
// 로직(validateRoute)에는 사용하지 않는다(요구사항 문서 6절).
export interface ParkingLot {
  id: string;
  name: string;
  totalLots: number | null;
  availLots: number | null;
  distanceKm: number;
}

// 국립해양조사원 해수욕지수(GetFcstBeachApiServicev2, data.go.kr 15142484) 원본 항목 1건.
// totalIndex/maxWvhgtM/avgWtemC는 API가 계산한 예보값을 가공·추측 없이 그대로 옮긴 값이다
// (요구사항 문서 5절). period는 predcNoonSeCd 원본값 그대로("오전"/"오후"/"일") — 당일~+2일은
// 오전/오후 두 건, 이후 4일은 "일" 단일 건으로 온다(2026-08-17 실호출로 확인, AC1/AC5). 이
// 차이를 그대로 노출해야 UI가 항상 오전/오후 두 칸을 강제해 값이 비거나 중복 표시되는 걸 막는다.
export interface BeachIndexEntry {
  date: string; // predcYmd 원본, YYYY-MM-DD
  period: "오전" | "오후" | "일";
  totalIndex: string; // API 원본 등급 문자열(매우나쁨~매우좋음 등)
  maxWvhgtM: number | null; // 최고파고(m), 파싱 실패 시 null
  avgWtemC: number | null; // 평균수온(℃), 파싱 실패 시 null
}

// KHOA 해수욕지수 연동(2026-08-17): category === "attraction"이고 이름에 "해변"/"해수욕장"이
// 포함된 명소에 이름 정규화 매칭(1:1)으로만 붙는다 — 반경 기반 좌표 매칭은 쓰지 않는다(AC8,
// 강문/안목에 인접한 경포 데이터가 잘못 붙는 걸 막기 위함). announcedDate는 entries 중 가장
// 이른 predcYmd — API 응답 자체엔 발표 "시각" 필드가 없음을 실호출로 확인했으므로(header/body/
// items 어디에도 없음), 없는 시각을 지어내지 않고 날짜만 노출한다("실시간" 금지, AC4).
export interface BeachIndex {
  entries: BeachIndexEntry[];
  announcedDate: string; // YYYY-MM-DD
}

export interface LifeSpot {
  id: string;
  name: string;
  spotType: "life";
  category: "attraction" | "stay" | "food" | "event";
  address: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  description?: string;
  tags: string[];
  // 옵션 B(2026-08-07): category === "event"일 때만 채워지는 관광공사 축제/행사 API
  // (searchFestival2) 원본 기간 필드(YYYYMMDD). 그 외 category에서는 항상 undefined —
  // 기존 LifeSpot 객체는 이 필드가 없어도 옵셔널이라 하위 호환이 깨지지 않는다.
  eventStartDate?: string;
  eventEndDate?: string;
  // 강릉시 주차 연동(2026-08-16): category === "attraction"일 때만 attachNearbyParking()이
  // 채운다. undefined = 매칭 시도 안 함(attraction이 아님), 빈 배열 = 매칭 시도했지만 반경
  // 내 주차장 없음/API 실패/키 미설정 — 둘 다 MapLifeSpotCard가 동일한 폴백 문구로 처리한다.
  parking?: ParkingLot[];
  // 국립해양조사원 해수욕지수 연동(2026-08-17): category === "attraction"이고 이름에 "해변"/
  // "해수욕장"이 포함된 명소일 때만 attachBeachIndex()가 채운다. undefined = 매칭 시도 안 함
  // (비-해변 명소), null = 매칭 시도했지만 KHOA 관측 지점 없음(강문/안목) 또는 API 실패/키
  // 미설정, 값 있음 = 매칭 성공(경포/주문진). parking 필드와 동일한 undefined/null/값 3단
  // 원칙(위 주석 참고).
  beachIndex?: BeachIndex | null;
  // 운영시간/입장료 연동(2026-08-18): category === "attraction"일 때만 buildMapAttractionSpots가
  // 배치(관광지 12 / 문화시설 14)별로 명시적으로 태깅한다 — API 응답에는 contenttypeid 필드
  // 자체가 없어 파싱으로는 구분할 수 없다(요구사항 문서 4절, buildNearbyLifeSpotCorpus와
  // 동일 원칙). /api/attraction-detail 호출 시 어떤 엔드포인트 조합을 쓸지 이 값으로 정한다.
  contentTypeId?: "12" | "14";
  // WorkSpot.tourismContentId와 동일한 목적 — LifeSpot.id가 `attraction-${contentid}` 형태라
  // 문자열 파싱으로도 뽑을 수 있지만, id 포맷이 바뀌면 깨지므로 원본 contentId를 명시적으로
  // 함께 보존한다(요구사항 문서 4-③).
  tourismContentId?: string;
}

// GET /api/attraction-detail 응답에 담기는 명소 운영 정보(2026-08-18 신규). hours/closedDays는
// contentTypeId=12일 때 usetime/restdate, 14일 때 usetimeculture/restdateculture 원본이고,
// fee는 14는 usefee, 12는 detailInfo2의 infoname==="입장료" 항목이다(요구사항 문서 6절).
// 빈 문자열("")은 null로 정규화되고, "연중무휴"/"상시 개방" 같은 실제 원문은 가공 없이 그대로
// 담긴다 — LifeSpot 타입에 영구 저장하지 않고 카드 클릭마다 조회해 로컬 상태로만 존재한다.
export interface OperatingInfo {
  hours: string | null;
  closedDays: string | null;
  fee: string | null;
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
    | "unverifiable-preference"
    | "workstyle-ranking"
    | "event-date";
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
