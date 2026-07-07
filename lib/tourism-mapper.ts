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
  return "cafe";
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
    power: { available: null },
    noise: inferNoise(item.title, inferCategory(item.title)),
    openHours: "정보 미제공",
    tags: ["관광공사DB"],
    imageUrl: item.firstimage,
    description: item.overview,
    tourismContentId: item.contentid,
  };
}

export function mapTourismToLifeSpot(item: TourismApiItem): LifeSpot {
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
