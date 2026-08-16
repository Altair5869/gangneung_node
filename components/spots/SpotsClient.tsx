"use client";

import { useState, useMemo } from "react";
import { WorkSpot } from "@/types";
import { cn, isBarrierFree } from "@/lib/utils";
import SpotCard from "@/components/spots/SpotCard";

function calcScore(spot: WorkSpot): number {
  let score = 0;
  if (spot.wifi.available) score += 30;
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
  // 옵션 I R4: elevator/restroom/parking은 exit 기준 "무장애" 토글과 별개로, 필드 의미와
  // 1:1로 대응하는 독립 칩으로만 추가한다. wheelchair는 필터로 만들지 않는다 — "휠체어 대여
  // 서비스" 여부라 접근성 필터로 쓰면 필드 의미를 왜곡하고, 실측상 거의 항상 비어있어 필터로도
  // 실효성이 없다(옵션 I R2/R4 근거, lib/utils.ts의 isBarrierFree 주석 참고).
  const [elevator, setElevator] = useState(false);
  const [restroom, setRestroom] = useState(false);
  const [parking, setParking] = useState(false);
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
      if (barrierFree && !isBarrierFree(s.barrierFree)) return false;
      if (elevator && s.barrierFree?.elevator !== true) return false;
      if (restroom && s.barrierFree?.restroom !== true) return false;
      if (parking && s.barrierFree?.parking !== true) return false;
      if (minScore > 0 && calcScore(s) < minScore) return false;
      return true;
    });
  }, [allSpots, query, category, noise, wifi, power, barrierFree, elevator, restroom, parking, minScore]);

  const isFiltered = !!(
    query || category || noise || wifi || power || barrierFree || elevator || restroom || parking || minScore > 0
  );

  const reset = () => {
    setQuery("");
    setCategory("");
    setNoise("");
    setWifi(false);
    setPower("");
    setBarrierFree(false);
    setElevator(false);
    setRestroom(false);
    setParking(false);
    setMinScore(0);
  };

  return (
    <>
      {/* 필터 바 */}
      <div className="sticky top-14 z-30 bg-background border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-2.5">

          {/* 검색창 */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="장소 이름 또는 주소로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl bg-muted focus:outline-none focus:border-primary focus:bg-background transition-colors text-foreground"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground text-xs"
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
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground/70 border-border hover:border-foreground/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-border hidden sm:block" />

            {/* 소음도 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-foreground/40 whitespace-nowrap">소음</span>
              {NOISE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNoise(opt.value)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    noise === opt.value
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground/70 border-border hover:border-foreground/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-border hidden sm:block" />

            {/* 콘센트 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-foreground/40 whitespace-nowrap">콘센트</span>
              {POWER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPower(opt.value)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    power === opt.value
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground/70 border-border hover:border-foreground/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-border hidden sm:block" />

            {/* 편의시설 토글 */}
            <div className="flex items-center gap-1.5">
              {[
                { label: "WiFi", active: wifi, toggle: () => setWifi((v) => !v), color: "bg-primary border-primary", textOn: "text-on-primary" },
                { label: "무장애", active: barrierFree, toggle: () => setBarrierFree((v) => !v), color: "bg-accent border-accent", textOn: "text-on-accent" },
                { label: "엘리베이터", active: elevator, toggle: () => setElevator((v) => !v), color: "bg-primary border-primary", textOn: "text-on-primary" },
                { label: "장애인 화장실", active: restroom, toggle: () => setRestroom((v) => !v), color: "bg-accent border-accent", textOn: "text-on-accent" },
                { label: "장애인 주차", active: parking, toggle: () => setParking((v) => !v), color: "bg-primary border-primary", textOn: "text-on-primary" },
              ].map(({ label, active, toggle, color, textOn }) => (
                <button
                  key={label}
                  onClick={toggle}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    active ? `${color} ${textOn}` : "bg-background text-foreground/70 border-border hover:border-foreground/40"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-border hidden sm:block" />

            {/* 작업 환경 점수 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-foreground/40 whitespace-nowrap">점수</span>
              {SCORE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMinScore(opt.value)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    minScore === opt.value
                      ? "bg-good text-on-good border-good"
                      : "bg-background text-foreground/70 border-border hover:border-foreground/40"
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
                  <span className="text-xs text-primary font-semibold whitespace-nowrap">
                    {filtered.length}곳 검색됨
                  </span>
                  <button
                    onClick={reset}
                    className="text-xs text-foreground/40 hover:text-foreground underline whitespace-nowrap transition-colors"
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
      <div className="relative flex-1 bg-background">
        <div className="relative max-w-6xl mx-auto px-4 py-8 w-full">
          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-lg font-semibold text-foreground">조건에 맞는 장소가 없어요</p>
              <p className="text-sm text-foreground/60 mt-1">검색어나 필터를 조정해보세요.</p>
              <button onClick={reset} className="mt-4 text-sm text-primary font-semibold hover:underline">
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
