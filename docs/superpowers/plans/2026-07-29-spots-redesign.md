# 스팟 페이지(목록+상세) 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/spots`(목록)와 `/spots/[id]`(상세) 및 공용 컴포넌트(`SpotCard`/`SpotsClient`/`WorkEnvScore`)를 홈페이지 리디자인의 컬러 토큰 체계로 리스킨하고, 신호등 상태 색상(good/warn/bad) 3종 토큰을 신규 도입하며, 다크모드 스타일링을 이 페이지 전체로 확장한다.

**Architecture:** 홈페이지 라운드에서 만든 `app/globals.css`의 CSS 커스텀 프로퍼티 + `@theme inline` 패턴을 그대로 확장한다 — 신규 토큰 3개(`--color-good`/`--color-warn`/`--color-bad`)를 같은 방식으로 추가하면 기존 `dark` 클래스 토글 메커니즘이 그대로 적용된다(추가 인프라 불필요). 신호등 배지는 `bg-{token}/15 text-{token}` 형태의 Tailwind v4 불투명도 모디파이어로 표현한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. 신규 의존성 없음.

## Global Constraints

- 신호등 색상(조용함/시끄러움, 콘센트 3단계, 혼잡도 3단계)은 유지하되 톤만 새 팔레트에 맞게 웜톤으로 조정한다 — 브랜드 컬러(틸/테라코타) 하나로 단순화하지 않는다
- 카테고리 그라디언트(카페/코워킹/도서관/호텔/기타)는 신규 토큰을 만들지 않고 기존 브랜드 토큰(`primary`/`primary-dark`/`hero-glow`/`accent`/`muted`)의 조합으로만 표현한다
- 미확인(`null`) 상태는 새 토큰을 쓰지 않고 기존 `--color-muted`/`text-foreground/60`를 재사용한다
- 이번 라운드는 `app/spots/page.tsx`, `components/spots/SpotsClient.tsx`, `components/spots/SpotCard.tsx`, `app/spots/[id]/page.tsx`, `components/spots/WorkEnvScore.tsx`, `app/globals.css`만 대상이다 — `components/spots/SpotFilter.tsx`(미사용 죽은 코드)는 건드리지 않는다. `/food`, `/stay`, `/events`, `/map`, `/planner`, `/ai-curator`는 범위 밖이다
- 다크모드는 이 라운드부터 목록+상세+공용 컴포넌트 전체에 적용한다(홈페이지 라운드는 홈페이지 1개 파일로 한정했었음) — 새 인프라 없이 기존 토큰 클래스만 쓰면 자동 적용됨
- 프로젝트에 테스트 프레임워크가 없다 — 각 태스크의 검증은 `npx tsc --noEmit`, `npx eslint`, `next dev` 로컬 실행 후 `curl`/육안 확인으로 대체한다
- 필터/정렬/점수 계산 등 기존 로직은 절대 변경하지 않는다 — 이번 라운드는 순수 시각적 리스킨이다

---

## Task 1: 신호등 상태 색상 토큰 (`app/globals.css`)

**Files:**
- Modify: `app/globals.css` (현재 43줄, 홈페이지 라운드에서 이미 `primary`/`primary-dark`/`hero-glow`/`accent`/`background`/`foreground`/`muted`/`border` 8개 토큰 + `@custom-variant dark` 선언이 있는 상태)

**Interfaces:**
- Consumes: 기존 토큰 8개(변경 없음)
- Produces: Tailwind 유틸리티 클래스 `bg-good`/`text-good`/`bg-warn`/`text-warn`/`bg-bad`/`text-bad` (및 `/15`, `/10`, `/30` 등 불투명도 모디파이어 조합). Task 2·5·6이 이 클래스명을 그대로 사용한다.

- [ ] **Step 1: `app/globals.css`의 `:root {}` 블록에 3줄 추가** (기존 `--color-border: #E6DCC6;` 다음 줄에)

```css
  --color-good: #3D7A52;
  --color-warn: #B8862E;
  --color-bad: #B84A3E;
```

- [ ] **Step 2: `:root.dark {}` 블록에 3줄 추가** (기존 `--color-border: #2C3E3B;` 다음 줄에)

```css
  --color-good: #5FBF7E;
  --color-warn: #D9A648;
  --color-bad: #E27367;
```

- [ ] **Step 3: `@theme inline {}` 블록에 3줄 추가** (기존 `--color-border: var(--color-border);` 다음 줄에)

```css
  --color-good: var(--color-good);
  --color-warn: var(--color-warn);
  --color-bad: var(--color-bad);
```

수정 후 `app/globals.css` 전체는 다음과 같아야 한다 (확인용 전체 파일):

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --color-primary: #0F6B62;
  --color-primary-dark: #0A3B37;
  --color-hero-glow: #0F6B62;
  --color-accent: #B8511E;
  --color-background: #FDFAF4;
  --color-foreground: #14100C;
  --color-muted: #F2EAD9;
  --color-border: #E6DCC6;
  --color-good: #3D7A52;
  --color-warn: #B8862E;
  --color-bad: #B84A3E;
}

:root.dark {
  --color-primary: #35C9B8;
  --color-accent: #E2793C;
  --color-background: #14201F;
  --color-foreground: #F3EEE3;
  --color-muted: #1C2B29;
  --color-border: #2C3E3B;
  --color-good: #5FBF7E;
  --color-warn: #D9A648;
  --color-bad: #E27367;
}

@theme inline {
  --color-primary: var(--color-primary);
  --color-primary-dark: var(--color-primary-dark);
  --color-hero-glow: var(--color-hero-glow);
  --color-accent: var(--color-accent);
  --color-background: var(--color-background);
  --color-foreground: var(--color-foreground);
  --color-muted: var(--color-muted);
  --color-border: var(--color-border);
  --color-good: var(--color-good);
  --color-warn: var(--color-warn);
  --color-bad: var(--color-bad);
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, sans-serif;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
}
```

- [ ] **Step 4: 검증**

Run:
```bash
npx tsc --noEmit
npm run dev &
sleep 3
curl -s http://localhost:3000/spots -o /dev/null -w "%{http_code}\n"
```
Expected: tsc 에러 0건, `/spots` 200 (아직 리스킨 전이라 색은 안 바뀐 채로 정상 렌더만 확인).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat: 신호등 상태 색상 토큰(good/warn/bad) 추가"
```

---

## Task 2: 스팟 카드 리스킨 (`components/spots/SpotCard.tsx`)

**Files:**
- Modify: `components/spots/SpotCard.tsx` (전체 133줄 교체)

**Interfaces:**
- Consumes: Task 1의 `bg-good`/`text-good`/`bg-warn`/`text-warn`/`bg-bad`/`text-bad` + 기존 `bg-primary`/`bg-accent`/`bg-primary-dark`/`bg-hero-glow`/`bg-muted`/`bg-background`/`text-foreground`/`border-border` 토큰
- Produces: 없음 (leaf 컴포넌트). 단, 이 파일에서 확정한 `categoryGradient`/`noiseBadge`/`powerBadge`/`congestionStyle` 색상 매핑을 Task 6(`app/spots/[id]/page.tsx`)이 동일하게 반복 사용해야 한다 — 아래 표를 Task 6에서도 그대로 참고할 것.

카테고리 그라디언트 매핑 (신규 토큰 없음, 기존 브랜드 토큰만 사용):

| 카테고리 | 그라디언트 클래스 |
|---|---|
| cafe | `from-accent to-accent/70` |
| coworking | `from-primary to-primary/70` |
| library | `from-primary-dark to-primary` |
| hotel | `from-hero-glow to-primary/60` |
| other | `from-border to-muted` |

- [ ] **Step 1: `components/spots/SpotCard.tsx` 전체를 아래 내용으로 교체**

```tsx
import Link from "next/link";
import { WorkSpot } from "@/types";
import { cn, noiseLabel, congestionLabel, powerLabel, isBarrierFree } from "@/lib/utils";

const categoryLabel: Record<WorkSpot["category"], string> = {
  cafe: "카페",
  coworking: "코워킹",
  library: "도서관",
  hotel: "호텔",
  other: "기타",
};

const categoryGradient: Record<WorkSpot["category"], string> = {
  cafe: "from-accent to-accent/70",
  coworking: "from-primary to-primary/70",
  library: "from-primary-dark to-primary",
  hotel: "from-hero-glow to-primary/60",
  other: "from-border to-muted",
};

const noiseBadge: Record<"언급됨-조용함" | "언급됨-시끄러움", string> = {
  "언급됨-조용함": "bg-good/15 text-good",
  "언급됨-시끄러움": "bg-bad/15 text-bad",
};

const powerBadge: Record<"충분함" | "제한적" | "없음", string> = {
  "충분함": "bg-good/15 text-good",
  "제한적": "bg-warn/15 text-warn",
  "없음": "bg-bad/15 text-bad",
};

const congestionStyle: Record<"low" | "medium" | "high", { dot: string; text: string }> = {
  low: { dot: "bg-good", text: "text-good" },
  medium: { dot: "bg-warn", text: "text-warn" },
  high: { dot: "bg-bad", text: "text-bad" },
};

export default function SpotCard({ spot }: { spot: WorkSpot }) {
  return (
    <Link href={`/spots/${spot.id}`} className="group block">
      <div className="bg-background rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200">

        {/* 이미지 / 카테고리 배경 */}
        <div className="h-44 relative overflow-hidden">
          {spot.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={spot.imageUrl}
              alt={spot.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center", categoryGradient[spot.category])}>
              <span className="text-white text-2xl font-bold opacity-30 select-none">
                {categoryLabel[spot.category]}
              </span>
            </div>
          )}

          {/* 카테고리 배지 */}
          <span className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full text-foreground shadow-sm">
            {categoryLabel[spot.category]}
          </span>

          {/* 혼잡도 배지 */}
          {spot.congestion && (
            <span className={cn(
              "absolute top-3 right-3 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm",
              congestionStyle[spot.congestion].text
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", congestionStyle[spot.congestion].dot)} />
              예상 {congestionLabel(spot.congestion)}
            </span>
          )}
        </div>

        {/* 정보 영역 */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
              {spot.name}
            </h3>
            <p className="text-xs text-foreground/60 mt-0.5 truncate">{spot.address}</p>
          </div>

          {/* 편의시설 뱃지 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", spot.noise !== "언급없음" ? noiseBadge[spot.noise] : "bg-muted text-foreground/60")}>
              {noiseLabel(spot.noise)}
            </span>
            {spot.wifi.available === true && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-good/15 text-good font-medium">
                WiFi
              </span>
            )}
            {spot.wifi.available === null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/60 font-medium">
                WiFi 미확인
              </span>
            )}
            {spot.power.level !== null && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", powerBadge[spot.power.level])}>
                {powerLabel(spot.power.level)}
              </span>
            )}
            {spot.power.level === null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/60 font-medium">
                콘센트 미확인
              </span>
            )}
            {isBarrierFree(spot.barrierFree) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-good/15 text-good font-medium">
                무장애
              </span>
            )}
          </div>

          {/* 영업시간 + 태그 */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs text-foreground/60">{spot.openHours}</span>
            <div className="flex gap-1">
              {spot.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-xs text-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint components/spots/SpotCard.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 하드코딩 색상 잔존 확인**

Run: `grep -nE "gray-[0-9]|sky-[0-9]|teal-[0-9]|blue-[0-9]|amber-[0-9]|orange-[0-9]|emerald-[0-9]|slate-[0-9]|green-[0-9]|red-[0-9]|yellow-[0-9]|purple-[0-9]" components/spots/SpotCard.tsx`
Expected: 결과 없음 (exit code 1) — 전부 토큰 클래스로 교체됐는지 확인

- [ ] **Step 4: Commit**

```bash
git add components/spots/SpotCard.tsx
git commit -m "feat: SpotCard 컬러 토큰 리스킨 (신호등 상태색 적용)"
```

---

## Task 3: 필터 바 + 그리드 리스킨 (`components/spots/SpotsClient.tsx`)

**Files:**
- Modify: `components/spots/SpotsClient.tsx` (전체 262줄 교체)

**Interfaces:**
- Consumes: Task 1·2의 토큰 클래스, `SpotCard` (기존 import 유지)
- Produces: 없음

**필터 활성 상태 색상 매핑** (스펙 근거: WiFi→primary, 무장애→accent, 점수→good, 나머지(카테고리/소음/콘센트)→foreground):

| 필터 | 활성 색상 |
|---|---|
| 카테고리 / 소음 / 콘센트 | `bg-foreground text-background border-foreground` |
| WiFi 토글 | `bg-primary text-white border-primary` |
| 무장애 토글 | `bg-accent text-white border-accent` |
| 점수 필터 | `bg-good text-white border-good` |

- [ ] **Step 1: `components/spots/SpotsClient.tsx` 전체를 아래 내용으로 교체**

```tsx
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
      if (barrierFree && !isBarrierFree(s.barrierFree)) return false;
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
                { label: "WiFi", active: wifi, toggle: () => setWifi((v) => !v), color: "bg-primary border-primary" },
                { label: "무장애", active: barrierFree, toggle: () => setBarrierFree((v) => !v), color: "bg-accent border-accent" },
              ].map(({ label, active, toggle, color }) => (
                <button
                  key={label}
                  onClick={toggle}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors",
                    active ? `${color} text-white` : "bg-background text-foreground/70 border-border hover:border-foreground/40"
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
                      ? "bg-good text-white border-good"
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
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint components/spots/SpotsClient.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 하드코딩 색상 잔존 확인**

Run: `grep -nE "gray-[0-9]|sky-[0-9]|teal-[0-9]|blue-[0-9]|green-[0-9]" components/spots/SpotsClient.tsx`
Expected: 결과 없음

- [ ] **Step 4: 필터 인터랙션 회귀 확인 (로컬 서버)**

Run:
```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/spots | grep -o "조용함 언급\|WiFi\|무장애\|60점+" | sort -u
```
Expected: 필터 옵션 라벨들이 응답 HTML에 그대로 존재 — 마크업 구조 안 깨졌는지 확인. (클릭 인터랙션 자체는 브라우저 도구 없는 환경이라 코드 레벨 확인만)

- [ ] **Step 5: Commit**

```bash
git add components/spots/SpotsClient.tsx
git commit -m "feat: 필터 바 + 그리드 컬러 토큰 리스킨, 블롭 장식 제거"
```

---

## Task 4: 목록 페이지 헤더 배너 (`app/spots/page.tsx`)

**Files:**
- Modify: `app/spots/page.tsx` (전체 33줄 교체)

**Interfaces:**
- Consumes: Task 1의 `--color-primary-dark`/`--color-hero-glow` (홈페이지 히어로와 동일한 모드 불변 그라디언트 패턴 재사용), `SpotsClient` (기존 import 유지)
- Produces: 없음

- [ ] **Step 1: `app/spots/page.tsx` 전체를 아래 내용으로 교체**

```tsx
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
      {/* 헤더 배너 — 라이트/다크 공용 짙은 톤 (홈페이지 히어로와 동일 패턴) */}
      <section className="bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">Workation Spots</p>
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
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint app/spots/page.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 렌더 확인**

Run:
```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/spots
```
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add app/spots/page.tsx
git commit -m "feat: 스팟 목록 헤더 배너 컬러 토큰 리스킨"
```

---

## Task 5: 작업환경 점수 카드 (`components/spots/WorkEnvScore.tsx`)

**Files:**
- Modify: `components/spots/WorkEnvScore.tsx` (전체 98줄 교체)

**Interfaces:**
- Consumes: Task 1의 `good`/`warn`/`bad` + 기존 `primary` 토큰
- Produces: 없음. `spot` prop 타입/컴포넌트 시그니처는 변경 없음 — Task 6(`app/spots/[id]/page.tsx`)의 `<WorkEnvScore spot={spot} />` 호출부는 그대로 유지된다.

점수 4단계 색상 매핑: 최적(80+)=`good`, 좋음(60-79)=`primary`, 보통(40-59)=`warn`, 낮음(<40)=`bad`.
체크리스트 3단계 매핑: `true`=`good`(솔직 배지), `false`=`bad`(옅은 배지), `null`(미확인)=`muted`/`foreground-60`(중립).

- [ ] **Step 1: `components/spots/WorkEnvScore.tsx` 전체를 아래 내용으로 교체**

```tsx
import { WorkSpot } from "@/types";
import { cn, powerLabel, wifiLabel } from "@/lib/utils";

function calcScore(spot: WorkSpot): { score: number; label: string } {
  let score = 0;
  if (spot.wifi.available) score += 30;
  if (spot.power.level === "충분함") score += 25;
  else if (spot.power.level === "제한적") score += 10;
  if (spot.noise === "언급됨-조용함") score += 25;
  if (spot.congestion === "low") score += 10;
  else if (spot.congestion === "medium") score += 5;

  const label = score >= 80 ? "최적" : score >= 60 ? "좋음" : score >= 40 ? "보통" : "낮음";
  return { score, label };
}

const CRITERIA = [
  { key: "wifi",       label: "WiFi 가용" },
  { key: "power",      label: "콘센트 (충분함/제한적)" },
  { key: "quiet",      label: "조용함 언급" },
  { key: "uncrowded",  label: "여유로운 혼잡도" },
] as const;

function scoreColor(score: number) {
  if (score >= 80) return { bar: "bg-good",  text: "text-good",  ring: "bg-good/10 border-good/30" };
  if (score >= 60) return { bar: "bg-primary", text: "text-primary", ring: "bg-primary/10 border-primary/30" };
  if (score >= 40) return { bar: "bg-warn",  text: "text-warn",  ring: "bg-warn/10 border-warn/30" };
  return               { bar: "bg-bad",   text: "text-bad",   ring: "bg-bad/10 border-bad/30" };
}

// 체크 항목은 확정 true/false 뿐 아니라 "미확인"(null)도 가질 수 있다 (예: wifi.available).
// null을 false로 뭉개면 "확정된 없음"처럼 보이므로, 배지 아이콘/색을 3단계로 분리한다.
function checkVisual(state: boolean | null) {
  if (state === true) return { badge: "bg-good text-white", icon: "✓", text: "text-foreground" };
  if (state === false) return { badge: "bg-bad/15 text-bad", icon: "✗", text: "text-foreground/60" };
  return { badge: "bg-muted text-foreground/60 border border-border", icon: "–", text: "text-foreground/60 italic" };
}

export default function WorkEnvScore({ spot }: { spot: WorkSpot }) {
  const { score, label } = calcScore(spot);
  const { bar, text, ring } = scoreColor(score);

  // wifi만 null(미확인)을 가질 수 있는 tri-state. 나머지는 항상 boolean이지만
  // 레코드 타입은 하나로 통일해 checkVisual이 모든 항목에 동일하게 적용되게 한다.
  const checks: Record<(typeof CRITERIA)[number]["key"], boolean | null> = {
    wifi:      spot.wifi.available,
    power:     spot.power.level === "충분함" || spot.power.level === "제한적",
    quiet:     spot.noise === "언급됨-조용함",
    uncrowded: spot.congestion === "low" || spot.congestion === "medium",
  };

  return (
    <div className="bg-background border border-border rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-bold text-foreground/40 uppercase tracking-widest">작업 환경 점수</h2>

      {/* 점수 */}
      <div className={cn("flex items-center justify-between rounded-xl px-4 py-3 border", ring)}>
        <span className={cn("text-4xl font-bold", text)}>{score}</span>
        <div className="text-right">
          <p className={cn("text-lg font-bold", text)}>{label}</p>
          <p className="text-xs text-foreground/40">/ 90점</p>
        </div>
      </div>

      {/* 점수 바 */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", bar)}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* 체크리스트 */}
      <ul className="space-y-2">
        {CRITERIA.map((c) => {
          const v = checkVisual(checks[c.key]);
          const criterionLabel =
            c.key === "power" ? powerLabel(spot.power.level) :
            c.key === "wifi"  ? wifiLabel(spot.wifi.available) :
            c.label;
          return (
            <li key={c.key} className="flex items-center gap-2.5 text-sm">
              <span className={cn(
                "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold",
                v.badge
              )}>
                {v.icon}
              </span>
              <span className={v.text}>
                {criterionLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint components/spots/WorkEnvScore.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: Commit**

```bash
git add components/spots/WorkEnvScore.tsx
git commit -m "feat: 작업환경 점수 카드 컬러 토큰 리스킨"
```

---

## Task 6: 스팟 상세 페이지 (`app/spots/[id]/page.tsx`)

**Files:**
- Modify: `app/spots/[id]/page.tsx` (전체 253줄 교체)

**Interfaces:**
- Consumes: Task 1의 전체 토큰, Task 2에서 확정한 `categoryGradient`/`noiseBg`/`congestionStyle` 매핑(동일하게 반복), `WorkEnvScore`(Task 5, 기존 import·시그니처 그대로)
- Produces: 없음 (leaf 페이지)

- [ ] **Step 1: `app/spots/[id]/page.tsx` 전체를 아래 내용으로 교체**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { noiseLabel, congestionLabel, cn, isBarrierFree } from "@/lib/utils";
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
  cafe: "from-accent to-accent/70",
  coworking: "from-primary to-primary/70",
  library: "from-primary-dark to-primary",
  hotel: "from-hero-glow to-primary/60",
  other: "from-border to-muted",
};

const noiseBg: Record<string, string> = {
  "언급됨-조용함": "bg-good/15 text-good",
  "언급됨-시끄러움": "bg-bad/15 text-bad",
};

const congestionStyle: Record<string, { bg: string; dot: string }> = {
  low: { bg: "bg-good/15 text-good", dot: "bg-good" },
  medium: { bg: "bg-warn/15 text-warn", dot: "bg-warn" },
  high: { bg: "bg-bad/15 text-bad", dot: "bg-bad" },
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
    <div className="flex flex-col min-h-screen bg-background">

      {/* 히어로 */}
      <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-muted">
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
          className="absolute top-5 left-5 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-sm font-medium px-3 py-1.5 rounded-full text-foreground hover:bg-background transition-colors shadow-sm"
        >
          ← 목록으로
        </Link>

        {/* 히어로 배지들 */}
        <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
          <span className="bg-background/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-foreground shadow-sm">
            {categoryLabel[spot.category]}
          </span>
          {isBarrierFree(spot.barrierFree) && (
            <span className="bg-good text-xs font-semibold px-3 py-1 rounded-full text-white shadow-sm">
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
              <h1 className="text-3xl font-bold text-foreground leading-tight">{spot.name}</h1>
              <p className="text-foreground/60 mt-1.5 text-sm">{spot.address}</p>
            </div>

            {/* 설명 */}
            {spot.description && (
              <p className="text-foreground/80 leading-relaxed text-sm border-l-4 border-primary/30 pl-4">
                {spot.description}
              </p>
            )}

            {/* 핵심 스펙 */}
            <div>
              <h2 className="text-sm font-bold text-foreground/40 uppercase tracking-widest mb-3">작업 환경</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SpecCard
                  label="WiFi"
                  value={spot.wifi.available === null ? "정보 없음" : spot.wifi.available ? "있음" : "없음"}
                  available={spot.wifi.available}
                  accentColor="primary"
                />
                <SpecCard
                  label="콘센트"
                  value={spot.power.level ?? "정보 없음"}
                  available={spot.power.level === null ? null : spot.power.level !== "없음"}
                  accentColor="accent"
                />
                <SpecCard
                  label="영업 시간"
                  value={spot.openHours}
                  available={true}
                  accentColor="border"
                />
                <div className="bg-background border border-border rounded-2xl p-4">
                  <p className="text-xs text-foreground/40 mb-2">소음도</p>
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", spot.noise !== "언급없음" ? noiseBg[spot.noise] : "bg-muted text-foreground/60")}>
                    {noiseLabel(spot.noise)}
                  </span>
                </div>
                {spot.congestion && (
                  <div className="bg-background border border-border rounded-2xl p-4">
                    <p className="text-xs text-foreground/40 mb-2">예상 혼잡도</p>
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
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-primary mb-3">무장애 편의시설</h2>
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
                          available ? "bg-good text-white" : "bg-muted text-foreground/40 line-through"
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
                <span key={tag} className="text-xs text-foreground/60 bg-background border border-border px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-4">
            <WorkEnvScore spot={spot} />

            {/* 지도 자리 */}
            <div className="bg-muted border border-border rounded-2xl h-44 flex flex-col items-center justify-center gap-1 text-foreground/40">
              <div className="w-8 h-8 rounded-full border-2 border-border flex items-center justify-center text-foreground/40 font-bold text-sm">
                지
              </div>
              <p className="text-xs text-foreground/40">지도 준비 중</p>
            </div>

            {/* AI 큐레이터 CTA — 라이트/다크 공용 짙은 톤 (홈페이지 히어로와 동일 패턴) */}
            <Link
              href="/ai-curator"
              className="block w-full text-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] text-white py-3.5 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg"
            >
              AI로 동선 짜기
            </Link>

            {/* 목록으로 */}
            <Link
              href="/spots"
              className="block w-full text-center text-foreground/60 text-sm font-medium py-2.5 rounded-2xl border border-border hover:border-foreground/40 hover:text-foreground transition-all"
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
  accentColor: "primary" | "accent" | "border";
}) {
  const accent = {
    primary: "border-l-primary",
    accent: "border-l-accent",
    border: "border-l-border",
  }[accentColor];

  return (
    <div className={cn(
      "bg-background border border-border rounded-2xl p-4 border-l-4",
      available ? accent : "border-l-border opacity-60"
    )}>
      <p className="text-xs text-foreground/40 mb-1">{label}</p>
      <p className={cn("text-sm font-bold", available ? "text-foreground" : "text-foreground/40")}>
        {value}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint "app/spots/[id]/page.tsx"`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 하드코딩 색상 잔존 확인**

Run: `grep -nE "gray-[0-9]|sky-[0-9]|teal-[0-9]|blue-[0-9]|purple-[0-9]|black/5" "app/spots/[id]/page.tsx"`
Expected: `bg-gradient-to-t from-black/50` 한 줄만 매칭(히어로 이미지 하단 가독성용 오버레이, 토큰과 무관하게 유지하기로 한 부분) — 그 외 매칭 없음

- [ ] **Step 4: 렌더 확인 (실측 id로)**

Run:
```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/spots/tourism-2775583
```
Expected: `200`

- [ ] **Step 5: Commit**

```bash
git add "app/spots/[id]/page.tsx"
git commit -m "feat: 스팟 상세 페이지 컬러 토큰 리스킨"
```

---

## Task 7: 최종 검증

**Files:** 없음 (검증 전용)

**Interfaces:** 없음

- [ ] **Step 1: 전체 타입체크 + lint**

Run: `npx tsc --noEmit && npx eslint app/globals.css app/spots/page.tsx "app/spots/[id]/page.tsx" components/spots/SpotCard.tsx components/spots/SpotsClient.tsx components/spots/WorkEnvScore.tsx`
Expected: 전부 에러 0건

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공, 관련 파일 에러 0건

- [ ] **Step 3: 신호등 토큰 WCAG 대비 계산 (라이트+다크)**

`good`/`warn`/`bad` 각각에 대해 두 가지 조합을 계산한다: (a) 텍스트 색 그 자체 vs `background`(솔리드 배지용, 예: 무장애 배지의 `bg-good text-white`는 흰 텍스트 대 good 배경), (b) `/15` 불투명도 배지(예: `bg-good/15 text-good`)의 실제 합성색 대비. Python이나 Node 한 줄 스크립트로 직접 계산(커밋하지 않음), 라이트/다크 각각 6개 조합(3토큰 × 2용도) 전부 4.5:1 이상인지 확인. 미달 항목이 있으면 해당 토큰 값을 조정하고 재계산, `app/globals.css`에 반영 후 커밋.

- [ ] **Step 4: 카테고리 그라디언트 텍스트 대비 확인**

카드 썸네일의 `text-white opacity-30` 카테고리 라벨(이미지 없을 때만 표시)은 장식적 텍스트라 AA 기준 대상이 아님 — 육안으로 5개 카테고리 그라디언트 각각에서 텍스트가 완전히 안 보이지는 않는지만 확인(현재도 `opacity-30`으로 의도적으로 흐릿함).

- [ ] **Step 5: 링크/라우팅 회귀 확인**

Run:
```bash
curl -s http://localhost:3000/api/spots | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['spots'][0]['id'])"
```
위에서 얻은 실제 id로 `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/spots/<id>` 실행 — `200` 확인. `/spots` 목록도 `200` 확인.

- [ ] **Step 6: 다크모드 토글 실측 (로컬 브라우저, 가능한 경우)**

`next dev` 상태에서 `/spots`와 `/spots/[id]` 각각 다크 토글 전환 후 신호등 배지·필터 활성 상태·카드 배경이 전부 자연스럽게 전환되는지 육안 확인. 브라우저 도구가 없는 환경이면 이 스텝은 "코드 레벨 확인만, 브라우저 실행 재현 아님"으로 명시하고 건너뛴다.

- [ ] **Step 7: 최종 커밋 (필요 시)**

Step 3에서 토큰 값을 조정했다면:
```bash
git add app/globals.css
git commit -m "fix: 신호등 토큰 대비 조정"
```
조정이 없었다면 이 스텝은 생략.
