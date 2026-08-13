import { notFound } from "next/navigation";
import Link from "next/link";
import { getDetailCommon, getFoodList } from "@/lib/tourism-api";
import { mapTourismToFoodSpot } from "@/lib/tourism-mapper";
import { getKakaoRestaurants } from "@/lib/kakao-local-api";

export const dynamic = "force-dynamic";

export default async function FoodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // R1(2026-08-13): /food 목록이 이제 카카오 FD6 항목(id: "kakao-food-{placeId}")도 포함하므로,
  // 관광공사 단건조회(getDetailCommon)로 넘기기 전에 먼저 분기한다 — 카카오 출처 항목은
  // 관광공사 contentId가 아예 없어 getDetailCommon에 잘못 넘기면 항상 404가 난다.
  if (id.startsWith("kakao-food-")) {
    const kakaoSpots = await getKakaoRestaurants().catch(() => []);
    const spot = kakaoSpots.find((s) => s.id === id);
    if (!spot) notFound();

    const kakaoMapUrl = `https://map.kakao.com/link/map/${encodeURIComponent(spot.name)},${spot.lat},${spot.lng}`;

    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-muted">
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-400" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <Link
            href="/food"
            className="absolute top-5 left-5 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-sm font-medium px-3 py-1.5 rounded-full text-foreground hover:bg-background transition-colors shadow-sm"
          >
            ← 맛집 목록
          </Link>

          <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
            <span className="bg-background/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-foreground shadow-sm">
              음식점
            </span>
            <span className="bg-yellow-400 text-xs font-semibold px-3 py-1 rounded-full text-gray-900 shadow-sm">
              카카오맵
            </span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground leading-tight">{spot.name}</h1>
                <p className="text-foreground/70 mt-1.5 text-sm">{spot.address || "주소 정보 없음"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {spot.tags.map((tag) => (
                  <span key={tag} className="text-xs text-foreground/70 bg-background border border-border px-3 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <a
                href={kakaoMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-yellow-400 text-gray-900 py-3.5 rounded-2xl text-sm font-bold hover:bg-yellow-300 transition-colors shadow-sm"
              >
                카카오맵에서 보기
              </a>

              <Link
                href="/ai-curator"
                className="block w-full text-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] text-white py-3.5 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg"
              >
                AI로 동선 짜기
              </Link>

              <Link
                href="/food"
                className="block w-full text-center text-foreground/70 text-sm font-medium py-2.5 rounded-2xl border border-border hover:border-foreground/40 hover:text-foreground transition-all"
              >
                목록으로 돌아가기
              </Link>

              <p className="text-xs text-foreground/60 text-center leading-relaxed">
                본 데이터는 카카오 로컬 API<br />(category_group_code=FD6)를 활용합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="flex flex-col min-h-screen bg-background">
      {/* 히어로 */}
      <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-muted">
        {listSpot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listSpot.imageUrl} alt={listSpot.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-400" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        <Link
          href="/food"
          className="absolute top-5 left-5 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-sm font-medium px-3 py-1.5 rounded-full text-foreground hover:bg-background transition-colors shadow-sm"
        >
          ← 맛집 목록
        </Link>

        <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
          <span className="bg-background/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-foreground shadow-sm">
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
              <h1 className="text-3xl font-bold text-foreground leading-tight">{listSpot.name}</h1>
              <p className="text-foreground/70 mt-1.5 text-sm">{listSpot.address || "주소 정보 없음"}</p>
            </div>

            {detail.overview && (
              <p className="text-foreground/80 leading-relaxed text-sm border-l-4 border-orange-200 pl-4">
                {detail.overview}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {listSpot.tags.map((tag) => (
                <span key={tag} className="text-xs text-foreground/70 bg-background border border-border px-3 py-1 rounded-full">
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
              className="block w-full text-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] text-white py-3.5 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg"
            >
              AI로 동선 짜기
            </Link>

            <Link
              href="/food"
              className="block w-full text-center text-foreground/70 text-sm font-medium py-2.5 rounded-2xl border border-border hover:border-foreground/40 hover:text-foreground transition-all"
            >
              목록으로 돌아가기
            </Link>

            <p className="text-xs text-foreground/60 text-center leading-relaxed">
              본 데이터는 한국관광공사<br />공공 OpenAPI를 활용합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
