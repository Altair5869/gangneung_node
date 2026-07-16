import { NextResponse } from "next/server";
import { getFoodList } from "@/lib/tourism-api";
import { mapTourismToFoodSpot } from "@/lib/tourism-mapper";

// 관광공사 API는 카페/베이커리도 "음식점"(contentTypeId 39) 하나로 묶어서 준다.
// 이 목록은 AI 큐레이터가 "카페에서 일한 뒤 갈 식당"으로 쓰므로, 이미 워크스팟(카페) 후보로
// 잡히는 곳이 식당 자리에 또 나오지 않도록 카페류 이름을 걸러낸다.
const CAFE_KEYWORDS = ["카페", "커피", "coffee", "cafe", "베이커리", "브루어리", "빵집", "제과"];

function looksLikeCafe(name: string): boolean {
  const lower = name.toLowerCase();
  return CAFE_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function GET() {
  try {
    const items = await getFoodList();
    const spots = items
      .filter((item) => item.mapx && item.mapy && parseFloat(item.mapx) !== 0)
      .filter((item) => !looksLikeCafe(item.title))
      .map(mapTourismToFoodSpot);
    return NextResponse.json({ spots });
  } catch {
    return NextResponse.json({ spots: [] });
  }
}
