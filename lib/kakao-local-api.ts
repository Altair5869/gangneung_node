import { WorkSpot } from "@/types";

function inferNoise(name: string): WorkSpot["noise"] {
  const t = name.toLowerCase();
  if (t.includes("독서실") || t.includes("스터디") || t.includes("study") || t.includes("도서관")) return "quiet";
  if (t.includes("코워킹") || t.includes("공유오피스") || t.includes("coworking")) return "quiet";
  if (t.includes("브루어리") || t.includes("brewery") || t.includes("브루") || t.includes("펍")) return "noisy";
  return null;
}

// 강릉 주요 구역 중심점 (반경 6km씩 커버)
const CENTERS = [
  { x: "128.8759", y: "37.7519" }, // 강릉 시내/역
  { x: "128.9170", y: "37.7956" }, // 경포대/강문해변
  { x: "128.8218", y: "37.8981" }, // 주문진
  { x: "128.8500", y: "37.8300" }, // 사천
  { x: "129.0500", y: "37.6800" }, // 정동진
];
const RADIUS = 6000;

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

async function fetchCafePage(center: { x: string; y: string }, page: number): Promise<KakaoPlace[]> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  url.searchParams.set("category_group_code", "CE7");
  url.searchParams.set("x", center.x);
  url.searchParams.set("y", center.y);
  url.searchParams.set("radius", String(RADIUS));
  url.searchParams.set("size", "15");
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data: KakaoLocalResponse = await res.json();
  return data.documents;
}

async function fetchAllPagesForCenter(center: { x: string; y: string }): Promise<KakaoPlace[]> {
  const pages = await Promise.all([
    fetchCafePage(center, 1),
    fetchCafePage(center, 2),
    fetchCafePage(center, 3),
  ]);
  return pages.flat();
}

export async function getKakaoCafes(): Promise<WorkSpot[]> {
  if (!process.env.KAKAO_REST_API_KEY) return [];

  try {
    const results = await Promise.all(CENTERS.map(fetchAllPagesForCenter));

    // ID 기준 중복 제거
    const seen = new Set<string>();
    const unique = results.flat().filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return unique.map((p) => ({
      id: `kakao-${p.id}`,
      name: p.place_name,
      category: "cafe" as const,
      address: p.road_address_name || p.address_name,
      lat: parseFloat(p.y),
      lng: parseFloat(p.x),
      wifi: { available: null },
      power: { available: null },
      noise: inferNoise(p.place_name),
      openHours: "정보 미제공",
      tags: ["카카오맵"],
      imageUrl: "",
    }));
  } catch {
    return [];
  }
}
