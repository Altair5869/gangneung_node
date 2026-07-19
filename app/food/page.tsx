import Link from "next/link";
import { getFoodList } from "@/lib/tourism-api";
import { mapTourismToFoodSpot } from "@/lib/tourism-mapper";
import { looksLikeCafe } from "@/lib/utils";
import { LifeSpot } from "@/types";

export const metadata = {
  title: "강릉 맛집 | 강릉 노드",
  description: "한국관광공사 공식 데이터 기반 강릉 음식점 정보",
};

export default async function FoodPage() {
  let spots: LifeSpot[] = [];
  try {
    const items = await getFoodList();
    spots = items
      .filter((item) => item.mapx && item.mapy && parseFloat(item.mapx) !== 0)
      .filter((item) => !looksLikeCafe(item.title))
      .map(mapTourismToFoodSpot);
  } catch (err) {
    console.error("[FoodPage] getFoodList failed:", err);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-orange-200 text-xs font-semibold tracking-widest uppercase mb-2">Food</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">강릉 맛집 정보</h1>
          <p className="text-white/80 text-sm">
            한국관광공사 공식 OpenAPI 기반 강릉 음식점 {spots.length}곳
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 w-full flex-1">
        {spots.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-semibold mb-2">데이터를 불러오는 중입니다</p>
            <p className="text-sm">잠시 후 다시 시도해주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {spots.map((spot) => (
              <FoodCard key={spot.id} spot={spot} />
            ))}
          </div>
        )}
        <p className="mt-10 text-center text-xs text-gray-400">
          본 데이터는 한국관광공사 공공 OpenAPI (KorService2 · contentTypeId=39)를 활용합니다.
        </p>
      </div>
    </div>
  );
}

function FoodCard({ spot }: { spot: LifeSpot }) {
  return (
    <Link href={`/food/${spot.id}`} className="block">
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-orange-200 hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
      {spot.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={spot.imageUrl} alt={spot.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
          <span className="text-orange-300 text-sm font-semibold">이미지 없음</span>
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-gray-900 mb-1 leading-tight line-clamp-2">{spot.name}</h3>
        <p className="text-xs text-gray-400 truncate mb-3">{spot.address || "주소 정보 없음"}</p>
        <div className="mt-auto flex gap-1.5 flex-wrap">
          {spot.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
    </Link>
  );
}
