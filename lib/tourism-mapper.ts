import { TourismApiItem, BarrierFreeItem, WorkSpot, LifeSpot, EventApiItem, EventSpot } from "@/types";

function inferNoise(title: string, category: WorkSpot["category"]): WorkSpot["noise"] {
  const t = title.toLowerCase();
  if (category === "library") return "언급됨-조용함";
  if (t.includes("독서실") || t.includes("스터디") || t.includes("study")) return "언급됨-조용함";
  if (t.includes("코워킹") || t.includes("공유오피스") || t.includes("coworking")) return "언급됨-조용함";
  if (t.includes("브루어리") || t.includes("brewery") || t.includes("브루") || t.includes("펍") || t.includes("pub")) return "언급됨-시끄러움";
  return "언급없음";
}

function inferCategory(title: string): WorkSpot["category"] {
  const t = title.toLowerCase();
  if (t.includes("카페") || t.includes("커피") || t.includes("coffee") || t.includes("브루어리")) return "cafe";
  if (t.includes("코워킹") || t.includes("공유오피스") || t.includes("스터디")) return "coworking";
  if (t.includes("도서관") || t.includes("library")) return "library";
  if (t.includes("호텔") || t.includes("리조트") || t.includes("hotel")) return "hotel";
  return "other";
}

export function mapTourismToWorkSpot(item: TourismApiItem): WorkSpot {
  const lat = parseFloat(item.mapy);
  const lng = parseFloat(item.mapx);
  return {
    id: `tourism-${item.contentid}`,
    name: item.title,
    category: inferCategory(item.title),
    address: [item.addr1, item.addr2].filter(Boolean).join(" ").trim(),
    lat: isNaN(lat) ? 37.751 : lat,
    lng: isNaN(lng) ? 128.876 : lng,
    wifi: { available: null },
    power: { level: null },
    noise: inferNoise(item.title, inferCategory(item.title)),
    openHours: "정보 미제공",
    tags: ["관광공사DB"],
    imageUrl: item.firstimage,
    description: item.overview,
    tourismContentId: item.contentid,
  };
}

// contentTypeId(2026-08-18 신규 인자): 어떤 배치(관광지 12 / 문화시설 14)로 요청했는지 아는
// 호출부(buildMapAttractionSpots)만 명시적으로 넘긴다 — API 응답 파싱이 아니라 호출 시점의
// 지식을 그대로 태깅하는 원칙(요구사항 문서 4절). 생략하면 기존 호출부(buildLifeSpotCorpus,
// buildNearbyLifeSpotCorpus 등)와 완전히 동일하게 동작한다(하위 호환, undefined로 남음).
// tourismContentId는 이 필드 유무와 무관하게 항상 채운다 — WorkSpot과 동일한 관례.
export function mapTourismToLifeSpot(item: TourismApiItem, contentTypeId?: "12" | "14"): LifeSpot {
  const lat = parseFloat(item.mapy);
  const lng = parseFloat(item.mapx);
  return {
    id: `attraction-${item.contentid}`,
    name: item.title,
    spotType: "life",
    category: "attraction",
    address: [item.addr1, item.addr2].filter(Boolean).join(" ").trim(),
    lat: isNaN(lat) ? 37.751 : lat,
    lng: isNaN(lng) ? 128.876 : lng,
    imageUrl: item.firstimage,
    description: item.overview,
    tags: ["관광지", "관광공사DB"],
    tourismContentId: item.contentid,
    ...(contentTypeId ? { contentTypeId } : {}),
  };
}

export function mapTourismToStaySpot(item: TourismApiItem): LifeSpot {
  const base = mapTourismToLifeSpot(item);
  return { ...base, id: `stay-${item.contentid}`, category: "stay", tags: ["숙박", "관광공사DB"] };
}

export function mapTourismToFoodSpot(item: TourismApiItem): LifeSpot {
  const base = mapTourismToLifeSpot(item);
  return { ...base, id: `food-${item.contentid}`, category: "food", tags: ["음식점", "관광공사DB"] };
}

export function mapTourismToEventSpot(item: EventApiItem): EventSpot {
  const lat = parseFloat(item.mapy);
  const lng = parseFloat(item.mapx);
  return {
    id: `event-${item.contentid}`,
    name: item.title,
    address: [item.addr1, item.addr2].filter(Boolean).join(" ").trim(),
    lat: isNaN(lat) ? 37.751 : lat,
    lng: isNaN(lng) ? 128.876 : lng,
    imageUrl: item.firstimage,
    startDate: item.eventstartdate ?? "",
    endDate: item.eventenddate ?? "",
    eventPlace: item.eventplace,
    tags: ["행사/축제", "관광공사DB"],
  };
}

// 옵션 B(2026-08-07): searchFestival2(EventApiItem) → LifeSpot 어댑터. EventSpot(기존 타입)은
// spotType/category/description이 없어 RouteStop = WorkSpot | LifeSpot 유니온에 그대로 넣을 수
// 없으므로, curateRoute 파이프라인에 태우기 위한 별도 변환 함수다. id는 mapTourismToEventSpot과
// 동일하게 `event-${contentid}` — 다른 id 스킴(food-/stay-/attraction-/kakao- 등)과 접두사가
// 겹치지 않는다. eventStartDate/eventEndDate는 관광공사 API 원본 문자열을 가공 없이 그대로
// 옮긴다(값이 없으면 undefined로 남겨 validateRoute가 "이벤트 아님"으로 취급하게 한다 — 빈
// 문자열로 채우면 "" <= today <= "" 비교가 항상 false가 되어 사실상 하드코딩된 실패가 된다).
export function mapEventToLifeSpot(item: EventApiItem): LifeSpot {
  const lat = parseFloat(item.mapy);
  const lng = parseFloat(item.mapx);
  return {
    id: `event-${item.contentid}`,
    name: item.title,
    spotType: "life",
    category: "event",
    address: [item.addr1, item.addr2].filter(Boolean).join(" ").trim(),
    lat: isNaN(lat) ? 37.751 : lat,
    lng: isNaN(lng) ? 128.876 : lng,
    imageUrl: item.firstimage,
    description: item.overview,
    tags: ["행사/축제", "관광공사DB"],
    eventStartDate: item.eventstartdate,
    eventEndDate: item.eventenddate,
  };
}

function parseBarrierField(val?: string): boolean {
  if (!val) return false;
  return val !== "0" && val.trim() !== "" && val !== "없음" && val !== "불가";
}

export function mapBarrierFreeToWorkSpot(item: BarrierFreeItem): WorkSpot {
  const base = mapTourismToWorkSpot(item);
  return {
    ...base,
    id: `barrier-free-${item.contentid}`,
    tags: [...base.tags, "무장애"],
    barrierFree: {
      wheelchair: parseBarrierField(item.wheelchair),
      elevator: parseBarrierField(item.elevator),
      restroom: parseBarrierField(item.restroom),
      parking: parseBarrierField(item.parking),
      exit: parseBarrierField(item.exit),
    },
  };
}
