import { notFound } from "next/navigation";
import Link from "next/link";
import { getDetailCommon, getFoodList } from "@/lib/tourism-api";
import { mapTourismToFoodSpot } from "@/lib/tourism-mapper";

export const dynamic = "force-dynamic";

export default async function FoodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // id 형식: "food-{contentid}"
  const contentId = id.replace(/^food-/, "");
  if (!contentId) notFound();

  const [detail, listItems] = await Promise.all([
    getDetailCommon(contentId).catch(() => null),
    getFoodList().catch(() => []),
  ]);

  if (!detail) notFound();

  const listSpot = listItems
    .map(mapTourismToFoodSpot)
    .find((s) => s.id === id) ?? mapTourismToFoodSpot(detail);

  const lat = parseFloat(detail.mapy);
  const lng = parseFloat(detail.mapx);
  const kakaoMapUrl =
    !isNaN(lat) && !isNaN(lng)
      ? `https://map.kakao.com/link/map/${encodeURIComponent(detail.title)},${lat},${lng}`
      : null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* 히어로 */}
      <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-gray-200">
        {listSpot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listSpot.imageUrl} alt={listSpot.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-400" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        <Link
          href="/food"
          className="absolute top-5 left-5 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-sm font-medium px-3 py-1.5 rounded-full text-gray-700 hover:bg-white transition-colors shadow-sm"
        >
          ← 맛집 목록
        </Link>

        <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
          <span className="bg-white/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-gray-700 shadow-sm">
            음식점
          </span>
          <span className="bg-orange-500 text-xs font-semibold px-3 py-1 rounded-full text-white shadow-sm">
            관광공사DB
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* 왼쪽: 주요 정보 */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">{listSpot.name}</h1>
              <p className="text-gray-500 mt-1.5 text-sm">{listSpot.address || "주소 정보 없음"}</p>
            </div>

            {detail.overview && (
              <p className="text-gray-700 leading-relaxed text-sm border-l-4 border-orange-200 pl-4">
                {detail.overview}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {listSpot.tags.map((tag) => (
                <span key={tag} className="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-4">
            {kakaoMapUrl && (
              <a
                href={kakaoMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-yellow-400 text-gray-900 py-3.5 rounded-2xl text-sm font-bold hover:bg-yellow-300 transition-colors shadow-sm"
              >
                카카오맵에서 보기
              </a>
            )}

            <Link
              href="/ai-curator"
              className="block w-full text-center bg-gradient-to-r from-sky-700 to-teal-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-sky-700/20"
            >
              AI로 동선 짜기
            </Link>

            <Link
              href="/food"
              className="block w-full text-center text-gray-500 text-sm font-medium py-2.5 rounded-2xl border border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-all"
            >
              목록으로 돌아가기
            </Link>

            <p className="text-xs text-gray-400 text-center leading-relaxed">
              본 데이터는 한국관광공사<br />공공 OpenAPI를 활용합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
