import { notFound } from "next/navigation";
import Link from "next/link";
import { noiseLabel, congestionLabel, cn } from "@/lib/utils";
import WorkEnvScore from "@/components/spots/WorkEnvScore";
import { WorkSpot } from "@/types";

async function getSpot(id: string): Promise<WorkSpot | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/spots/${id}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json() as { spot: WorkSpot };
  return data.spot ?? null;
}

export const dynamic = "force-dynamic";

const categoryLabel: Record<string, string> = {
  cafe: "카페", coworking: "코워킹", library: "도서관", hotel: "호텔", other: "기타",
};

const categoryGradient: Record<string, string> = {
  cafe: "from-amber-400 to-orange-400",
  coworking: "from-blue-500 to-indigo-500",
  library: "from-emerald-400 to-teal-500",
  hotel: "from-sky-400 to-blue-500",
  other: "from-gray-400 to-slate-500",
};

const noiseBg: Record<string, string> = {
  quiet: "bg-green-100 text-green-700",
  moderate: "bg-yellow-100 text-yellow-700",
  noisy: "bg-red-100 text-red-700",
};

const congestionStyle: Record<string, { bg: string; dot: string }> = {
  low: { bg: "bg-green-100 text-green-700", dot: "bg-green-400" },
  medium: { bg: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400" },
  high: { bg: "bg-red-100 text-red-700", dot: "bg-red-400" },
};

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spot = await getSpot(id);
  if (!spot) notFound();

  const gradient = categoryGradient[spot.category] ?? categoryGradient.other;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* 히어로 */}
      <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-gray-200">
        {spot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover" />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-br", gradient)} />
        )}
        {/* 하단 페이드 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* 뒤로 가기 */}
        <Link
          href="/spots"
          className="absolute top-5 left-5 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-sm font-medium px-3 py-1.5 rounded-full text-gray-700 hover:bg-white transition-colors shadow-sm"
        >
          ← 목록으로
        </Link>

        {/* 히어로 배지들 */}
        <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
          <span className="bg-white/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-gray-700 shadow-sm">
            {categoryLabel[spot.category]}
          </span>
          {spot.barrierFree !== undefined && (
            <span className="bg-teal-600 text-xs font-semibold px-3 py-1 rounded-full text-white shadow-sm">
              무장애
            </span>
          )}
          {spot.congestion && (
            <span className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full shadow-sm", congestionStyle[spot.congestion].bg)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", congestionStyle[spot.congestion].dot)} />
              예상 {congestionLabel(spot.congestion)}
            </span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* 왼쪽: 주요 정보 */}
          <div className="lg:col-span-2 space-y-6">

            {/* 제목 + 주소 */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">{spot.name}</h1>
              <p className="text-gray-500 mt-1.5 text-sm">{spot.address}</p>
            </div>

            {/* 설명 */}
            {spot.description && (
              <p className="text-gray-700 leading-relaxed text-sm border-l-4 border-sky-200 pl-4">
                {spot.description}
              </p>
            )}

            {/* 핵심 스펙 */}
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">작업 환경</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SpecCard
                  label="WiFi"
                  value={spot.wifi.available === true ? `${spot.wifi.speedMbps ?? "?"}Mbps` : spot.wifi.available === false ? "없음" : "정보 없음"}
                  available={spot.wifi.available}
                  accentColor="sky"
                />
                <SpecCard
                  label="콘센트"
                  value={spot.power.available === true ? `${spot.power.outlets ?? "?"}개 이상` : spot.power.available === false ? "없음" : "정보 없음"}
                  available={spot.power.available}
                  accentColor="purple"
                />
                <SpecCard
                  label="영업 시간"
                  value={spot.openHours}
                  available={true}
                  accentColor="gray"
                />
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-2">소음도</p>
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", spot.noise ? noiseBg[spot.noise] : "bg-gray-100 text-gray-400")}>
                    {noiseLabel(spot.noise)}
                  </span>
                </div>
                {spot.congestion && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    <p className="text-xs text-gray-400 mb-2">예상 혼잡도</p>
                    <span className={cn("flex items-center gap-1.5 text-xs font-semibold w-fit px-2.5 py-1 rounded-full", congestionStyle[spot.congestion].bg)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", congestionStyle[spot.congestion].dot)} />
                      {congestionLabel(spot.congestion)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 무장애 편의시설 */}
            {spot.barrierFree !== undefined && (
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-teal-800 mb-3">무장애 편의시설</h2>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "wheelchair", label: "휠체어 대여" },
                    { key: "elevator", label: "엘리베이터" },
                    { key: "restroom", label: "장애인 화장실" },
                    { key: "parking", label: "장애인 주차" },
                    { key: "exit", label: "출입 가능" },
                  ].map(({ key, label }) => {
                    const available = spot.barrierFree?.[key as keyof typeof spot.barrierFree];
                    return (
                      <span
                        key={key}
                        className={cn(
                          "text-xs px-3 py-1 rounded-full font-semibold",
                          available ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-400 line-through"
                        )}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 태그 */}
            <div className="flex flex-wrap gap-2">
              {spot.tags.map((tag) => (
                <span key={tag} className="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-4">
            <WorkEnvScore spot={spot} />

            {/* 지도 자리 */}
            <div className="bg-gradient-to-br from-sky-50 to-teal-50 border border-sky-100 rounded-2xl h-44 flex flex-col items-center justify-center gap-1 text-sky-400">
              <div className="w-8 h-8 rounded-full border-2 border-sky-300 flex items-center justify-center text-sky-500 font-bold text-sm">
                지
              </div>
              <p className="text-xs text-sky-400">지도 준비 중</p>
            </div>

            {/* AI 큐레이터 CTA */}
            <Link
              href="/ai-curator"
              className="block w-full text-center bg-gradient-to-r from-sky-700 to-teal-600 text-white py-3.5 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-sky-700/20"
            >
              AI로 동선 짜기
            </Link>

            {/* 목록으로 */}
            <Link
              href="/spots"
              className="block w-full text-center text-gray-500 text-sm font-medium py-2.5 rounded-2xl border border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-all"
            >
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecCard({
  label, value, available, accentColor,
}: {
  label: string;
  value: string;
  available: boolean | null;
  accentColor: "sky" | "purple" | "gray";
}) {
  const accent = {
    sky: "border-l-sky-400",
    purple: "border-l-purple-400",
    gray: "border-l-gray-300",
  }[accentColor];

  return (
    <div className={cn(
      "bg-white border border-gray-200 rounded-2xl p-4 border-l-4",
      available ? accent : "border-l-gray-200 opacity-60"
    )}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={cn("text-sm font-bold", available ? "text-gray-900" : "text-gray-400")}>
        {value}
      </p>
    </div>
  );
}
