import { Suspense } from "react";
import { WorkSpot } from "@/types";
import SpotCard from "@/components/spots/SpotCard";
import SpotFilter from "@/components/spots/SpotFilter";

async function getSpots(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/spots?${qs}`, {
    cache: "no-store",
  });
  const data = await res.json() as { spots: WorkSpot[] };
  return data.spots;
}

export default async function SpotsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const spots = await getSpots(params);

  const isFiltered = Object.keys(params).some((k) => ["noise", "wifi", "power", "barrierFree"].includes(k));

  return (
    <div className="flex flex-col min-h-screen">
      {/* 헤더 배너 */}
      <section className="bg-gradient-to-r from-sky-700 via-blue-600 to-teal-600 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sky-300 text-xs font-semibold tracking-widest uppercase mb-2">Workation Spots</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">강릉 워크스팟</h1>
          <p className="text-white/70 text-sm">
            한국관광공사 공식 데이터 기반 —&nbsp;
            <span className="text-white font-semibold">{spots.length}곳</span>의 장소를 탐색하세요
          </p>
        </div>
      </section>

      {/* 필터 바 */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Suspense>
            <SpotFilter />
          </Suspense>
          {isFiltered && (
            <span className="ml-auto text-xs text-sky-600 font-semibold whitespace-nowrap">
              {spots.length}곳 필터됨
            </span>
          )}
        </div>
      </div>

      {/* 스팟 그리드 */}
      <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white">
        {/* 배경 장식 */}
        <div className="absolute top-0 right-[-10%] w-[500px] h-[500px] bg-sky-100/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-[-10%] w-[400px] h-[400px] bg-teal-100/50 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 py-8 w-full">
          {spots.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-lg font-semibold text-gray-700">조건에 맞는 장소가 없어요</p>
              <p className="text-sm text-gray-400 mt-1">필터를 조정해보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {spots.map((spot) => (
                <SpotCard key={spot.id} spot={spot} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
