import { TourismApiItem, BarrierFreeItem, WorkSpot } from "@/types";

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
    wifi: { available: true, speedMbps: 50 },
    power: { available: true, outlets: 4 },
    noise: "moderate",
    openHours: "정보 미제공",
    tags: ["관광공사DB"],
    imageUrl: item.firstimage,
    description: item.overview,
    tourismContentId: item.contentid,
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
