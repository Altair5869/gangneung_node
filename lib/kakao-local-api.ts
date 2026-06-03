import { WorkSpot } from "@/types";

const GANGNEUNG = { x: "128.8759", y: "37.7519" };
const RADIUS = 20000; // 20km

interface KakaoPlace {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  x: string;
  y: string;
}

interface KakaoLocalResponse {
  documents: KakaoPlace[];
  meta: { is_end: boolean };
}

async function fetchCafePage(page: number): Promise<KakaoLocalResponse> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  url.searchParams.set("category_group_code", "CE7");
  url.searchParams.set("x", GANGNEUNG.x);
  url.searchParams.set("y", GANGNEUNG.y);
  url.searchParams.set("radius", String(RADIUS));
  url.searchParams.set("size", "15");
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Kakao Local API error: ${res.status}`);
  return res.json();
}

export async function getKakaoCafes(): Promise<WorkSpot[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return [];

  try {
    const [page1, page2, page3] = await Promise.all([
      fetchCafePage(1),
      fetchCafePage(2),
      fetchCafePage(3),
    ]);

    const places = [
      ...page1.documents,
      ...page2.documents,
      ...page3.documents,
    ];

    return places.map((p) => ({
      id: `kakao-${p.id}`,
      name: p.place_name,
      category: "cafe" as const,
      address: p.road_address_name || p.address_name,
      lat: parseFloat(p.y),
      lng: parseFloat(p.x),
      wifi: { available: true, speedMbps: 50 },
      power: { available: true, outlets: 4 },
      noise: "moderate" as const,
      openHours: "정보 미제공",
      tags: ["카카오맵"],
      imageUrl: "",
    }));
  } catch {
    return [];
  }
}
