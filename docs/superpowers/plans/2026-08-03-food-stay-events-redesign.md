# /food, /stay, /events 페이지 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/food`, `/stay`, `/events` 5개 파일(목록 3개 + 상세 2개)을 홈페이지·스팟·AI 큐레이터·`/map`·`/planner` 라운드에서 만든 컬러 토큰 체계로 리스킨하고 다크모드를 지원한다. 컬러 토큰 리스킨의 마지막 라운드.

**Architecture:** 신규 토큰 없음 — 기존 `app/globals.css`의 `background`/`foreground`/`muted`/`border`/`primary-dark`/`hero-glow` 토큰을 재사용한다. 섹션별 브랜드색(food=주황, stay=인디고, events=로즈)이 들어가는 요소(히어로 그라디언트, 카드 hover 테두리, 빈 이미지 플레이스홀더, 태그/상태 배지, "관광공사DB" 배지)는 토큰화하지 않고 지금 hex 값 그대로 모드 불변 고정 — 히어로에 `primary-dark`+`hero-glow`를 모드 불변으로 쓰는 기존 패턴과 동일 원칙.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. 신규 의존성 없음.

## Global Constraints

- 이번 라운드는 `app/food/page.tsx`, `app/food/[id]/page.tsx`, `app/stay/page.tsx`, `app/stay/[id]/page.tsx`, `app/events/page.tsx` 5개 파일만 대상이다.
- 프로젝트에 테스트 프레임워크가 없다 — 각 태스크의 검증은 `npx tsc --noEmit`, `npx eslint`, `next dev` 로컬 실행 후 `curl`/육안 확인으로 대체한다.
- 데이터 페칭(`getFoodList`/`getStayList`/`getEventList`/`getDetailCommon`), 필터링(`looksLikeCafe`, mapx/mapy 체크), `notFound()` 처리, `formatDate`/`getStatus` 로직은 절대 변경하지 않는다 — 이번 라운드는 순수 시각적 리스킨이다.
- **섹션 브랜드색 요소는 토큰화하지 않고 값 그대로 유지한다** — 히어로 그라디언트, 카드 hover 테두리(`hover:border-orange-200` 등), 빈 이미지 플레이스홀더(그라디언트+텍스트), 태그 배지(`bg-orange-50 text-orange-600` 등), 상태 배지(events의 진행중/예정), "관광공사DB" 배지, 상세 페이지 overview 인용문 테두리. 이 값들을 `bg-background`/`text-foreground` 등으로 바꾸면 스펙 위반이다.
- 히어로 서브텍스트(라벨+설명문)는 섹션별 색(`text-orange-200` 등)이나 `/80`을 쓰지 않고 전부 `text-white/70`으로 통일한다.
- 본문 보조 텍스트는 `text-foreground/60`(작은 안내문) 또는 `text-foreground/70`(주소·날짜 등 조금 더 강조) 이상을 쓴다 — `/40`, `/50`은 라이트모드에서 WCAG AA 미달로 반복 확인됐다(`d60ba07`, `/map`, `/planner` 라운드).
- 상세 페이지의 "AI로 동선 짜기" CTA(`bg-gradient-to-r from-sky-700 to-teal-600`)는 섹션 브랜드색이 아니라 사이트 공통 AI 큐레이터 정체성이므로 `bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))]`로 통일하고, 색상 특정 그림자(`shadow-sky-700/20`)는 `shadow-lg`만 남기고 제거한다.
- "카카오맵에서 보기" 버튼(`bg-yellow-400 text-gray-900`)은 카카오 고유 브랜드색이라 변경하지 않는다.
- `/events`에는 상세 페이지가 없다 — 신규로 만들지 않는다.

---

## Task 1: `/food` 리스킨 (목록 + 상세)

**Files:**
- Modify: `app/food/page.tsx` (전체 83줄 교체)
- Modify: `app/food/[id]/page.tsx` (전체 127줄 교체)

**Interfaces:**
- Consumes: `getFoodList`/`getDetailCommon`(`@/lib/tourism-api`), `mapTourismToFoodSpot`(`@/lib/tourism-mapper`), `looksLikeCafe`(`@/lib/utils`), `LifeSpot`(`@/types`) — 전부 기존 그대로, 시그니처 무변경
- Produces: 없음 (leaf 페이지 2개)

- [ ] **Step 1: `app/food/page.tsx` 전체를 아래 내용으로 교체**

```tsx
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
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">Food</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">강릉 맛집 정보</h1>
          <p className="text-white/70 text-sm">
            한국관광공사 공식 OpenAPI 기반 강릉 음식점 {spots.length}곳
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 w-full flex-1">
        {spots.length === 0 ? (
          <div className="text-center py-20 text-foreground/60">
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
        <p className="mt-10 text-center text-xs text-foreground/60">
          본 데이터는 한국관광공사 공공 OpenAPI (KorService2 · contentTypeId=39)를 활용합니다.
        </p>
      </div>
    </div>
  );
}

function FoodCard({ spot }: { spot: LifeSpot }) {
  return (
    <Link href={`/food/${spot.id}`} className="block">
    <div className="bg-background rounded-2xl border border-border overflow-hidden hover:shadow-md hover:border-orange-200 hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
      {spot.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={spot.imageUrl} alt={spot.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
          <span className="text-orange-300 text-sm font-semibold">이미지 없음</span>
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-foreground mb-1 leading-tight line-clamp-2">{spot.name}</h3>
        <p className="text-xs text-foreground/60 truncate mb-3">{spot.address || "주소 정보 없음"}</p>
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
```

- [ ] **Step 2: `app/food/[id]/page.tsx` 전체를 아래 내용으로 교체**

```tsx
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
```

- [ ] **Step 3: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint app/food/page.tsx app/food/\[id\]/page.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 4: 하드코딩 gray/white 색상 잔존 확인 (섹션 브랜드색인 orange/amber/yellow는 의도적으로 남아있어야 함)**

Run: `grep -nE '(bg|text|border)-(gray|white)-[0-9]{2,3}|bg-white\b' app/food/page.tsx app/food/\[id\]/page.tsx`
Expected: 결과 없음 (exit code 1) — `bg-yellow-400`(카카오 버튼)은 이 패턴에 안 걸림(의도적 예외)

- [ ] **Step 5: AI 큐레이터 CTA 표준화 확인**

Run: `grep -n "sky-700\|teal-600" app/food/\[id\]/page.tsx`
Expected: 결과 없음 (exit code 1)

- [ ] **Step 6: Commit**

```bash
git add app/food/page.tsx app/food/\[id\]/page.tsx
git commit -m "feat: /food 페이지 컬러 토큰 리스킨, 다크모드 지원"
```

---

## Task 2: `/stay` 리스킨 (목록 + 상세)

**Files:**
- Modify: `app/stay/page.tsx` (전체 82줄 교체)
- Modify: `app/stay/[id]/page.tsx` (전체 127줄 교체)

**Interfaces:**
- Consumes: `getStayList`/`getDetailCommon`(`@/lib/tourism-api`), `mapTourismToStaySpot`(`@/lib/tourism-mapper`), `LifeSpot`(`@/types`) — 전부 기존 그대로, 시그니처 무변경
- Produces: 없음 (leaf 페이지 2개)

- [ ] **Step 1: `app/stay/page.tsx` 전체를 아래 내용으로 교체**

```tsx
import Link from "next/link";
import { getStayList } from "@/lib/tourism-api";
import { mapTourismToStaySpot } from "@/lib/tourism-mapper";
import { LifeSpot } from "@/types";

export const metadata = {
  title: "강릉 숙박 | 강릉 노드",
  description: "한국관광공사 공식 데이터 기반 강릉 숙박시설 정보",
};

export default async function StayPage() {
  let spots: LifeSpot[] = [];
  try {
    const items = await getStayList();
    spots = items
      .filter((item) => item.mapx && item.mapy && parseFloat(item.mapx) !== 0)
      .map(mapTourismToStaySpot);
  } catch (err) {
    console.error("[StayPage] getStayList failed:", err);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-r from-indigo-700 via-violet-600 to-purple-600 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">Stay</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">강릉 숙박 정보</h1>
          <p className="text-white/70 text-sm">
            한국관광공사 공식 OpenAPI 기반 강릉 숙박시설 {spots.length}곳
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 w-full flex-1">
        {spots.length === 0 ? (
          <div className="text-center py-20 text-foreground/60">
            <p className="text-lg font-semibold mb-2">데이터를 불러오는 중입니다</p>
            <p className="text-sm">잠시 후 다시 시도해주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {spots.map((spot) => (
              <StayCard key={spot.id} spot={spot} />
            ))}
          </div>
        )}
        <p className="mt-10 text-center text-xs text-foreground/60">
          본 데이터는 한국관광공사 공공 OpenAPI (KorService2 · contentTypeId=32)를 활용합니다.
        </p>
      </div>
    </div>
  );
}

function StayCard({ spot }: { spot: LifeSpot }) {
  return (
    <Link href={`/stay/${spot.id}`} className="block">
    <div className="bg-background rounded-2xl border border-border overflow-hidden hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
      {spot.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={spot.imageUrl} alt={spot.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
          <span className="text-indigo-300 text-sm font-semibold">이미지 없음</span>
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-foreground mb-1 leading-tight line-clamp-2">{spot.name}</h3>
        <p className="text-xs text-foreground/60 truncate mb-3">{spot.address || "주소 정보 없음"}</p>
        <div className="mt-auto flex gap-1.5 flex-wrap">
          {spot.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
    </Link>
  );
}
```

- [ ] **Step 2: `app/stay/[id]/page.tsx` 전체를 아래 내용으로 교체**

```tsx
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
```

- [ ] **Step 3: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint app/stay/page.tsx app/stay/\[id\]/page.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 4: 하드코딩 gray/white 색상 잔존 확인**

Run: `grep -nE '(bg|text|border)-(gray|white)-[0-9]{2,3}|bg-white\b' app/stay/page.tsx app/stay/\[id\]/page.tsx`
Expected: 결과 없음 (exit code 1) — `bg-yellow-400`은 의도적 예외

- [ ] **Step 5: AI 큐레이터 CTA 표준화 확인**

Run: `grep -n "sky-700\|teal-600" app/stay/\[id\]/page.tsx`
Expected: 결과 없음 (exit code 1)

- [ ] **Step 6: Commit**

```bash
git add app/stay/page.tsx app/stay/\[id\]/page.tsx
git commit -m "feat: /stay 페이지 컬러 토큰 리스킨, 다크모드 지원"
```

---

## Task 3: `/events` 리스킨 (목록만, 상세 페이지 없음)

**Files:**
- Modify: `app/events/page.tsx` (전체 152줄 교체)

**Interfaces:**
- Consumes: `getEventList`(`@/lib/tourism-api`), `mapTourismToEventSpot`(`@/lib/tourism-mapper`), `EventSpot`/`EventApiItem`(`@/types`) — 전부 기존 그대로, 시그니처 무변경. `formatDate`/`getStatus` 로컬 함수도 로직 무변경.
- Produces: 없음 (leaf 페이지)

- [ ] **Step 1: `app/events/page.tsx` 전체를 아래 내용으로 교체**

```tsx
import { getEventList } from "@/lib/tourism-api";
import { mapTourismToEventSpot } from "@/lib/tourism-mapper";
import { EventSpot } from "@/types";
import { EventApiItem } from "@/types";

export const metadata = {
  title: "강릉 행사/축제 | 강릉 노드",
  description: "한국관광공사 공식 데이터 기반 강릉 행사 및 축제 정보",
};

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "";
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6).replace(/^0/, "");
  const d = yyyymmdd.slice(6, 8).replace(/^0/, "");
  return `${y}년 ${m}월 ${d}일`;
}

function getStatus(startDate: string, endDate: string): "ongoing" | "upcoming" | "ended" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDate = (s: string) => {
    if (!s || s.length < 8) return null;
    return new Date(
      parseInt(s.slice(0, 4)),
      parseInt(s.slice(4, 6)) - 1,
      parseInt(s.slice(6, 8))
    );
  };
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start) return "upcoming";
  if (end && end < today) return "ended";
  if (start <= today) return "ongoing";
  return "upcoming";
}

export default async function EventsPage() {
  let events: EventSpot[] = [];
  try {
    const items = await getEventList();
    events = (items as EventApiItem[]).map(mapTourismToEventSpot);
  } catch (err) {
    console.error("[EventsPage] getEventList failed:", err);
  }

  const ongoing = events.filter((e) => getStatus(e.startDate, e.endDate) === "ongoing");
  const upcoming = events.filter((e) => getStatus(e.startDate, e.endDate) === "upcoming");

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-r from-rose-600 via-pink-500 to-fuchsia-500 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">Events</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">강릉 행사 · 축제</h1>
          <p className="text-white/70 text-sm">
            한국관광공사 공식 OpenAPI 기반 강릉 지역 행사 및 축제 {events.length}건
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 w-full flex-1">
        {events.length === 0 ? (
          <div className="text-center py-20 text-foreground/60">
            <p className="text-lg font-semibold mb-2">현재 등록된 행사가 없습니다</p>
            <p className="text-sm">곧 강릉의 새로운 행사 정보가 업데이트됩니다.</p>
          </div>
        ) : (
          <>
            {ongoing.length > 0 && (
              <div className="mb-10">
                <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  진행 중
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {ongoing.map((event) => (
                    <EventCard key={event.id} event={event} status="ongoing" />
                  ))}
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400 inline-block" />
                  예정된 행사
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {upcoming.map((event) => (
                    <EventCard key={event.id} event={event} status="upcoming" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <p className="mt-10 text-center text-xs text-foreground/60">
          본 데이터는 한국관광공사 공공 OpenAPI (KorService2 · searchFestival2 · contentTypeId=15)를 활용합니다.
        </p>
      </div>
    </div>
  );
}

function EventCard({ event, status }: { event: EventSpot; status: "ongoing" | "upcoming" }) {
  return (
    <div className="bg-background rounded-2xl border border-border overflow-hidden hover:shadow-md hover:border-rose-200 hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
      {event.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.imageUrl} alt={event.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-rose-100 to-fuchsia-100 flex items-center justify-center">
          <span className="text-rose-300 text-sm font-semibold">이미지 없음</span>
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          {status === "ongoing" ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold">진행 중</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-600 font-semibold">예정</span>
          )}
        </div>
        <h3 className="font-bold text-foreground mb-1 leading-tight line-clamp-2">{event.name}</h3>
        {event.eventPlace && (
          <p className="text-xs text-foreground/70 truncate mb-1">{event.eventPlace}</p>
        )}
        <p className="text-xs text-foreground/60 truncate mb-3">{event.address || "주소 정보 없음"}</p>
        <div className="mt-auto">
          {(event.startDate || event.endDate) && (
            <p className="text-xs text-foreground/70 font-medium">
              {formatDate(event.startDate)}
              {event.endDate && event.endDate !== event.startDate && (
                <> ~ {formatDate(event.endDate)}</>
              )}
            </p>
          )}
          <div className="flex gap-1.5 flex-wrap mt-2">
            {event.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint app/events/page.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 하드코딩 gray/white 색상 잔존 확인**

Run: `grep -nE '(bg|text|border)-(gray|white)-[0-9]{2,3}|bg-white\b' app/events/page.tsx`
Expected: 결과 없음 (exit code 1)

- [ ] **Step 4: `formatDate`/`getStatus` 로직 무변경 확인**

Run: `git diff --unified=0 HEAD -- app/events/page.tsx | grep -E "^[+-]" | grep -vE "className|^\+\+\+|^---"`
Expected: 로직 라인(함수 본문, 조건문 등)에 대한 변경이 없어야 한다 — 변경되는 라인은 전부 JSX의 `className` 문자열이어야 함 (이 grep은 className이 아닌 +/- 라인만 걸러서 보여준다. 결과가 있으면 로직이 바뀐 것이므로 원인을 확인한다.)

- [ ] **Step 5: Commit**

```bash
git add app/events/page.tsx
git commit -m "feat: /events 페이지 컬러 토큰 리스킨, 다크모드 지원"
```

---

## Task 4: 최종 검증

**Files:** 없음 (검증 전용)

**Interfaces:** 없음

- [ ] **Step 1: 전체 타입체크 + lint**

Run: `npx tsc --noEmit && npx eslint app/food/page.tsx app/food/\[id\]/page.tsx app/stay/page.tsx app/stay/\[id\]/page.tsx app/events/page.tsx`
Expected: 전부 에러 0건

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공, 관련 파일 에러 0건. `getFoodList`/`getStayList`/`getEventList`가 빌드 환경에 API 키가 없어 401을 던지는 것은 기존부터 있던 무관한 동작이다(콘솔 로그로만 나오고 빌드 자체는 실패하지 않음) — 새로 발생한 에러가 아니면 무시한다.

- [ ] **Step 3: 섹션 브랜드색 보존 확인**

Run: `grep -c "orange\|amber\|yellow" app/food/page.tsx app/food/\[id\]/page.tsx`
Run: `grep -c "indigo\|violet\|purple" app/stay/page.tsx app/stay/\[id\]/page.tsx`
Run: `grep -c "rose\|pink\|fuchsia" app/events/page.tsx`
Expected: 전부 1 이상 — 섹션 브랜드색이 실수로 전부 사라지지 않았는지 확인(의도는 "구조적 chrome만 토큰화, 브랜드색은 유지"이므로 0이면 과교체된 것)

- [ ] **Step 4: 신규 조합 대비 확인**

`bg-background/90 text-foreground`(상세 페이지 사진 위 오버레이 버튼/배지)는 사진이라는 임의 배경 위에 얹히므로 `bg-background` 단독 배경 기준 검증 전제가 다르다 — 라이트/다크 각각 실측 확인한다(스팟 라운드에서 사진 위 반투명 배지가 대비 실패한 선례 있음).

- [ ] **Step 5: 렌더 확인 (로컬 서버)**

```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/food
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/stay
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/events
```
Expected: 셋 다 `200`

- [ ] **Step 6: 기능/다크모드 회귀 확인 (로컬 브라우저, 가능한 경우)**

`next dev` 상태에서 `/food`, `/stay`, `/events`를 열어: 목록 카드 grid 정상 렌더, 카드 클릭 시 `/food/[id]`·`/stay/[id]` 상세 페이지 이동, 상세 페이지의 "카카오맵에서 보기"/"AI로 동선 짜기"/"목록으로 돌아가기" 링크, `/events`의 진행중/예정 섹션 구분. 다크모드 토글 후 히어로(브랜드색 유지 확인)·카드·본문이 자연스럽게 전환되는지 육안 확인. 브라우저 도구가 없는 환경이면 "코드 레벨 확인만, 브라우저 실행 재현 아님"으로 명시하고 건너뛴다.

- [ ] **Step 7: 최종 커밋 (필요 시)**

Step 3~6에서 대비 미달이나 렌더/회귀 문제를 발견해 코드를 수정했다면:
```bash
git add app/food/page.tsx app/food/\[id\]/page.tsx app/stay/page.tsx app/stay/\[id\]/page.tsx app/events/page.tsx
git commit -m "fix: /food, /stay, /events 리스킨 대비/렌더 이슈 수정"
```
문제가 없었다면 이 스텝은 생략.
