import { notFound } from "next/navigation";
import Link from "next/link";
import { getDetailCommon, getStayList } from "@/lib/tourism-api";
import { mapTourismToStaySpot } from "@/lib/tourism-mapper";

export const dynamic = "force-dynamic";

export default async function StayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // id 형식: "stay-{contentid}"
  const contentId = id.replace(/^stay-/, "");
  if (!contentId) notFound();

  const [detail, listItems] = await Promise.all([
    getDetailCommon(contentId).catch(() => null),
    getStayList().catch(() => []),
  ]);

  if (!detail) notFound();

  const listSpot = listItems
    .map(mapTourismToStaySpot)
    .find((s) => s.id === id) ?? mapTourismToStaySpot(detail);

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
          <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-violet-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        <Link
          href="/stay"
          className="absolute top-5 left-5 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-sm font-medium px-3 py-1.5 rounded-full text-foreground hover:bg-background transition-colors shadow-sm"
        >
          ← 숙박 목록
        </Link>

        <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
          <span className="bg-background/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-foreground shadow-sm">
            숙박
          </span>
          <span className="bg-indigo-600 text-xs font-semibold px-3 py-1 rounded-full text-white shadow-sm">
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
              <p className="text-foreground/80 leading-relaxed text-sm border-l-4 border-indigo-200 pl-4">
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
              href="/stay"
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
