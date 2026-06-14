import { WorkSpot } from "@/types";
import SpotsClient from "@/components/spots/SpotsClient";

async function getAllSpots(): Promise<WorkSpot[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/spots`,
    { cache: "no-store" }
  );
  const data = (await res.json()) as { spots: WorkSpot[] };
  return data.spots ?? [];
}

export default async function SpotsPage() {
  const allSpots = await getAllSpots();

  return (
    <div className="flex flex-col min-h-screen">
      {/* 헤더 배너 */}
      <section className="bg-gradient-to-r from-sky-700 via-blue-600 to-teal-600 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sky-300 text-xs font-semibold tracking-widest uppercase mb-2">Workation Spots</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">강릉 워크스팟</h1>
          <p className="text-white/70 text-sm">
            한국관광공사 공식 데이터 기반 —&nbsp;
            <span className="text-white font-semibold">{allSpots.length}곳</span>의 장소를 탐색하세요
          </p>
        </div>
      </section>

      <SpotsClient allSpots={allSpots} />
    </div>
  );
}
