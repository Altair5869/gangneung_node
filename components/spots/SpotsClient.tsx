"use client";

import { useState, useMemo } from "react";
import { WorkSpot } from "@/types";
import { cn } from "@/lib/utils";
import SpotCard from "@/components/spots/SpotCard";

function calcScore(spot: WorkSpot): number {
  let score = 0;
  if (spot.wifi.available) score += 30;
  if ((spot.wifi.speedMbps ?? 0) >= 100) score += 10;
  if (spot.power.level === "충분함") score += 25;
  else if (spot.power.level === "제한적") score += 10;
  if (spot.noise === "언급됨-조용함") score += 25;
  if (spot.congestion === "low") score += 10;
  else if (spot.congestion === "medium") score += 5;
  return score;
}

const CATEGORIES: { value: WorkSpot["category"] | ""; label: string }[] = [
  { value: "", label: "전체" },
  { value: "cafe", label: "카페" },
  { value: "coworking", label: "코워킹" },
  { value: "library", label: "도서관" },
  { value: "hotel", label: "호텔" },
  { value: "other", label: "기타" },
];

const NOISE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "언급됨-조용함", label: "조용함 언급" },
  { value: "언급됨-시끄러움", label: "시끄러움 언급" },
];

const POWER_OPTIONS = [
  { value: "", label: "전체" },
  { value: "충분함", label: "충분함" },
  { value: "제한적", label: "제한적" },
  { value: "없음", label: "없음" },
];

const SCORE_OPTIONS = [
  { value: 0, label: "전체" },
  { value: 60, label: "60점+" },
  { value: 80, label: "80점+" },
];

export default function SpotsClient({ allSpots }: { allSpots: WorkSpot[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<WorkSpot["category"] | "">("");
  const [noise, setNoise] = useState("");
  const [wifi, setWifi] = useState(false);
  const [power, setPower] = useState("");
  const [barrierFree, setBarrierFree] = useState(false);
  const [minScore, setMinScore] = useState(0);

  const filtered = useMemo(() => {
    return allSpots.filter((s) => {
      if (query) {
        const q = query.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.address.toLowerCase().includes(q)) return false;
      }
      if (category && s.category !== category) return false;
      if (noise && s.noise !== noise) return false;
      if (wifi && s.wifi.available !== true) return false;
      if (power && s.power.level !== power) return false;
      if (barrierFree && s.barrierFree === undefined) return false;
      if (minScore > 0 && calcScore(s) < minScore) return false;
      return true;
    });
  }, [allSpots, query, category, noise, wifi, power, barrierFree, minScore]);

  const isFiltered = !!(query || category || noise || wifi || power || barrierFree || minScore > 0);

  const reset = () => {
    setQuery("");
    setCategory("");
    setNoise("");
    setWifi(false);
    setPower("");
    setBarrierFree(false);
    setMinScore(0);
  };

  return (
    <>
      {/* 필터 바 */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-2.5">

          {/* 검색창 */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="장소 이름 또는 주소로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-sky-400 focus:bg-white transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* 필터 토글들 */}
          <div className="flex flex-wrap items-center gap-2">

            {/* 카테고리 */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {CATEGORIES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCategory(opt.value as WorkSpot["category"] | "")}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    category === opt.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-gray-200 hidden sm:block" />

            {/* 소음도 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 whitespace-nowrap">소음</span>
              {NOISE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNoise(opt.value)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    noise === opt.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-gray-200 hidden sm:block" />

            {/* 콘센트 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 whitespace-nowrap">콘센트</span>
              {POWER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPower(opt.value)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    power === opt.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-gray-200 hidden sm:block" />

            {/* 편의시설 토글 */}
            <div className="flex items-center gap-1.5">
              {[
                { label: "WiFi", active: wifi, toggle: () => setWifi((v) => !v), color: "bg-blue-600 border-blue-600" },
                { label: "무장애", active: barrierFree, toggle: () => setBarrierFree((v) => !v), color: "bg-teal-600 border-teal-600" },
              ].map(({ label, active, toggle, color }) => (
                <button
                  key={label}
                  onClick={toggle}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    active ? `${color} text-white` : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-gray-200 hidden sm:block" />

            {/* 작업 환경 점수 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 whitespace-nowrap">점수</span>
              {SCORE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMinScore(opt.value)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    minScore === opt.value
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 결과 수 + 초기화 */}
            <div className="ml-auto flex items-center gap-3 flex-shrink-0">
              {isFiltered && (
                <>
                  <span className="text-xs text-sky-600 font-semibold whitespace-nowrap">
                    {filtered.length}곳 검색됨
                  </span>
                  <button
                    onClick={reset}
                    className="text-xs text-gray-400 hover:text-gray-700 underline whitespace-nowrap transition-colors"
                  >
                    초기화
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 스팟 그리드 */}
      <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white">
        <div className="absolute top-0 right-[-10%] w-[500px] h-[500px] bg-sky-100/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-[-10%] w-[400px] h-[400px] bg-teal-100/50 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 py-8 w-full">
          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-lg font-semibold text-gray-700">조건에 맞는 장소가 없어요</p>
              <p className="text-sm text-gray-400 mt-1">검색어나 필터를 조정해보세요.</p>
              <button onClick={reset} className="mt-4 text-sm text-sky-600 font-semibold hover:underline">
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((spot) => (
                <SpotCard key={spot.id} spot={spot} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
