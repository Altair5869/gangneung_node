# 홈페이지 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `app/page.tsx` 홈페이지를 강릉 로컬 브랜드(동해+커피 컬러) + 미니멀 구조 하이브리드로 리스킨하고, 수동 다크모드 토글을 도입하며, 중복된 두 섹션(플로우/기능카드)을 성격별로 재배치한다.

**Architecture:** CSS 커스텀 프로퍼티(`app/globals.css`)로 라이트/다크 컬러 토큰을 정의하고 Tailwind v4의 `@theme inline`으로 `bg-primary`/`text-foreground` 같은 유틸리티 클래스로 노출한다. 다크모드는 `<html>`의 `dark` 클래스 유무로 전환되며(미디어쿼리 아님), 컴포넌트는 `dark:` variant 없이 그냥 토큰 클래스만 쓰면 자동으로 두 모드를 지원한다. 토글 상태는 `localStorage`에 저장하고 하이드레이션 전 인라인 스크립트로 적용해 깜빡임을 막는다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. 신규 의존성 없음(아이콘은 인라인 SVG, 폰트는 Pretendard CDN `@import`).

## Global Constraints

- `WorkSpot.wifi.speedMbps`는 수집하지 않는 필드다 — 카피에 "WiFi 속도"를 실측 제공 데이터처럼 노출하지 않는다 (`CLAUDE.md` 데이터 규칙 2, `docs/DATA_STATUS.md`)
- 이번 라운드는 `app/page.tsx`와 전역 셸(`app/layout.tsx`, `components/NavMenu.tsx`, `app/globals.css`)만 대상이다 — `/spots`, `/map`, `/planner` 등 다른 페이지의 콘텐츠 스타일은 건드리지 않는다
- 다크모드는 수동 토글 방식이다(시스템 설정 자동 감지 아님). 기본값은 라이트
- 실사진 자산 없음 — 모든 시각 표현은 컬러 토큰 + 인라인 SVG 라인아트로 한다
- 신규 npm 패키지 설치 없음 (아이콘 라이브러리 없이 인라인 SVG로, 폰트는 CDN `@import`로)
- 프로젝트에 테스트 프레임워크가 없다(`package.json` scripts: `dev`/`build`/`start`/`lint`만 존재) — 각 태스크의 검증은 `npx tsc --noEmit`, `npx eslint`, `next dev` 로컬 실행 후 `curl`/육안 확인으로 대체한다

---

## Task 1: 디자인 토큰 + Pretendard 폰트 (`app/globals.css`)

**Files:**
- Modify: `app/globals.css` (전체 교체, 현재 26줄)

**Interfaces:**
- Consumes: 없음 (최상위 기반 작업)
- Produces: Tailwind 유틸리티 클래스 `bg-primary`/`text-primary`/`bg-primary-dark`(단, `primary-dark`는 라이트/다크 공용 고정값)/`bg-accent`/`text-accent`/`bg-background`/`text-foreground`/`bg-muted`/`border-border`. `<html>`에 `dark` 클래스가 붙으면 이 토큰들의 실제 색상값이 다크 팔레트로 전환된다. 이후 모든 태스크가 이 클래스명을 그대로 사용한다.

- [ ] **Step 1: `app/globals.css` 전체를 아래 내용으로 교체**

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
@import "tailwindcss";

:root {
  --color-primary: #0F6B62;
  --color-primary-dark: #0A3B37;
  --color-accent: #B8511E;
  --color-background: #FDFAF4;
  --color-foreground: #241F19;
  --color-muted: #F2EAD9;
  --color-border: #E6DCC6;
}

:root.dark {
  --color-primary: #35C9B8;
  --color-accent: #E2793C;
  --color-background: #14201F;
  --color-foreground: #F3EEE3;
  --color-muted: #1C2B29;
  --color-border: #2C3E3B;
}

@theme inline {
  --color-primary: var(--color-primary);
  --color-primary-dark: var(--color-primary-dark);
  --color-accent: var(--color-accent);
  --color-background: var(--color-background);
  --color-foreground: var(--color-foreground);
  --color-muted: var(--color-muted);
  --color-border: var(--color-border);
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, sans-serif;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
}
```

`--color-primary-dark`는 `:root.dark`에서 재선언하지 않는다 — 설계상 히어로 배경은 라이트/다크 모드 구분 없이 동일한 짙은 톤을 쓰기로 했으므로(스펙 "다크모드" 섹션), `:root`의 값이 두 모드 모두에서 그대로 유지된다.

- [ ] **Step 2: 개발 서버로 토큰이 깨지지 않고 로드되는지 확인**

Run:
```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
curl -s http://localhost:3000 | grep -o "Pretendard" | head -1
```
Expected: `200`, `Pretendard` 문자열이 응답 HTML(또는 링크된 CSS 참조) 어딘가에 존재. 서버 콘솔에 CSS 파싱 에러 없음.

- [ ] **Step 3: Arial 하드코딩이 완전히 제거됐는지 grep으로 확인**

Run: `grep -n "Arial" app/globals.css`
Expected: 결과 없음 (exit code 1)

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: 강릉 로컬 브랜드 컬러 토큰 + Pretendard 폰트 도입"
```

---

## Task 2: 다크모드 상태 유틸 + FOUC 방지 스크립트 (`lib/theme.ts`, `app/layout.tsx`)

**Files:**
- Create: `lib/theme.ts`
- Modify: `app/layout.tsx` (전체 33줄 교체)

**Interfaces:**
- Consumes: Task 1의 `bg-background`/`text-foreground`/`border-border` 토큰 클래스
- Produces: `lib/theme.ts`에서 `export type Theme = "light" | "dark"`, `export function getStoredTheme(): Theme`, `export function applyTheme(theme: Theme): void`. Task 4(`NavMenu.tsx`)가 이 세 심볼을 그대로 import해서 쓴다.

- [ ] **Step 1: `lib/theme.ts` 작성**

```ts
export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage 접근 불가 환경(프라이빗 모드 등) — 세션 내 토글은 계속 동작, 저장만 실패
  }
}
```

- [ ] **Step 2: `app/layout.tsx` 전체를 아래 내용으로 교체**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import NavMenu from "@/components/NavMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "강릉 노드 | Gangneung Node",
  description: "강릉 워케이션 장소 큐레이션 서비스",
};

const NO_FLASH_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="bg-background border-b border-border sticky top-0 z-50">
          <nav className="relative max-w-6xl mx-auto px-4 h-14 flex items-center gap-8">
            <Link href="/" className="font-bold text-lg tracking-tight flex-shrink-0 text-foreground">
              강릉 노드
            </Link>
            <NavMenu />
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
```

Geist 폰트 import(`next/font/google`)를 제거했다 — `grep -rn "font-mono\|font-geist" app components`로 사전 확인한 결과 `--font-geist-sans`/`--font-geist-mono` 변수는 이 두 파일 선언부 외에 실제 유틸리티 클래스로 소비되는 곳이 없어 제거해도 다른 컴포넌트에 영향 없다. 폰트는 Task 1에서 CDN `@import`로 넣은 Pretendard가 `body`에 전역 적용된다.

- [ ] **Step 3: 타입체크 + 다크 클래스 수동 적용 확인**

Run: `npx tsc --noEmit`
Expected: 에러 0건

Run:
```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep -o "NO_FLASH\|classList.toggle\|getItem('theme')" | head -3
```
Expected: 인라인 스크립트 문자열이 응답 HTML `<head>` 안에 그대로 포함되어 있음(SSR된 HTML에 스크립트 태그 존재 확인).

브라우저 콘솔에서 수동 확인(로컬 개발 중 1회):
```js
localStorage.setItem('theme', 'dark'); location.reload();
```
새로고침 직후 `<html>` 요소에 `class="... dark"`가 페인트 이전부터 붙어 있어야 한다(깜빡임 없이 body 배경이 곧바로 다크 톤).

- [ ] **Step 4: Commit**

```bash
git add lib/theme.ts app/layout.tsx
git commit -m "feat: 다크모드 상태 유틸 + FOUC 방지 스크립트, 헤더 셸 토큰 적용"
```

---

## Task 3: 시그니처 라인아트 컴포넌트 (`components/HorizonDivider.tsx`)

**Files:**
- Create: `components/HorizonDivider.tsx`

**Interfaces:**
- Consumes: 없음 (독립 컴포넌트, `currentColor`로 색상은 부모의 `text-*` 클래스를 따름)
- Produces: `export default function HorizonDivider({ className }: { className?: string })`. Task 5(`app/page.tsx`)가 이 컴포넌트를 히어로 하단, "왜 강릉인가" 배경에서 import해서 쓴다.

- [ ] **Step 1: `components/HorizonDivider.tsx` 작성**

```tsx
export default function HorizonDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={`w-full h-16 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M0,80 L120,40 L240,70 L360,20 L480,60 L600,30 L720,65 L840,15 L960,55 L1080,35 L1200,70 L1320,25 L1440,60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line x1="0" y1="95" x2="1440" y2="95" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
```

산맥 능선(꺾은선)과 그 아래 수평선(동해)을 표현하는 1px 라인 SVG다. `preserveAspectRatio="none"`으로 컨테이너 폭에 맞춰 늘어나며, 색은 부모에서 `text-white/15`, `text-primary/20`처럼 지정한다.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0건 (아직 아무 곳에서도 import하지 않으므로 미사용 경고는 발생하지 않음 — default export라 lint 미사용 규칙에 걸리지 않음)

- [ ] **Step 3: Commit**

```bash
git add components/HorizonDivider.tsx
git commit -m "feat: 산맥-수평선 라인아트 디바이더 컴포넌트 추가"
```

---

## Task 4: 다크모드 토글 버튼 (`components/NavMenu.tsx`)

**Files:**
- Modify: `components/NavMenu.tsx` (전체 74줄 교체)

**Interfaces:**
- Consumes: Task 2의 `lib/theme.ts` (`Theme`, `getStoredTheme`, `applyTheme`), Task 1의 토큰 클래스
- Produces: 없음 (leaf 컴포넌트, 이후 태스크가 이 파일을 참조하지 않음)

- [ ] **Step 1: `components/NavMenu.tsx` 전체를 아래 내용으로 교체**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

const NAV_LINKS = [
  { href: "/spots", label: "워크스팟" },
  { href: "/stay", label: "숙박" },
  { href: "/food", label: "맛집" },
  { href: "/events", label: "행사/축제" },
  { href: "/ai-curator", label: "AI 큐레이터" },
  { href: "/map", label: "지도" },
  { href: "/planner", label: "플래너" },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const pathname = usePathname();

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <>
      {/* 데스크탑 nav */}
      <div className="hidden md:flex items-center gap-5 text-sm font-medium text-foreground/70 ml-auto">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "hover:text-foreground transition-colors",
              pathname === href && "text-foreground font-semibold"
            )}
          >
            {label}
          </Link>
        ))}
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      {/* 모바일: 토글 + 햄버거 */}
      <div className="md:hidden flex items-center gap-1 ml-auto">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          aria-label="메뉴 열기"
        >
          <span className={cn("block w-5 h-0.5 bg-foreground/70 transition-all", open && "rotate-45 translate-y-2")} />
          <span className={cn("block w-5 h-0.5 bg-foreground/70 transition-all", open && "opacity-0")} />
          <span className={cn("block w-5 h-0.5 bg-foreground/70 transition-all", open && "-rotate-45 -translate-y-2")} />
        </button>
      </div>

      {/* 모바일 드롭다운 */}
      {open && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-background border-b border-border shadow-lg z-50">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-6 py-3.5 text-sm font-medium border-b border-border last:border-0 transition-colors",
                pathname === href
                  ? "text-primary bg-muted font-semibold"
                  : "text-foreground/70 hover:bg-muted"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="w-8 h-8 flex items-center justify-center rounded-full text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
```

기존 코드 대비 바뀐 점: 모든 하드코딩 회색/스카이 클래스(`text-gray-600`, `bg-white`, `text-sky-700 bg-sky-50` 등)를 토큰 클래스로 교체했고, 데스크탑 nav에 `ml-auto`를 추가해 토글 버튼이 오른쪽 끝에 붙게 했다.

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint components/NavMenu.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 토글 동작 실측**

Run:
```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep -o "다크 모드로 전환" | head -1
```
Expected: 버튼의 `aria-label` 문자열이 SSR HTML에 존재(초기 상태 `theme="light"`이므로 "다크 모드로 전환" 라벨이 나와야 함).

브라우저에서 수동 확인(로컬 1회): 토글 버튼 클릭 → 배경/텍스트 색이 즉시 다크 톤으로 바뀜 → 새로고침해도 다크 유지(Task 2의 FOUC 스크립트가 `localStorage` 읽어서 재적용) → 다시 클릭하면 라이트로 복귀.

- [ ] **Step 4: Commit**

```bash
git add components/NavMenu.tsx
git commit -m "feat: NavMenu에 다크모드 토글 버튼 추가, 헤더 하드코딩 컬러 토큰화"
```

---

## Task 5: 홈페이지 전체 리스킨 + 섹션 재배치 (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx` (전체 323줄 교체)

**Interfaces:**
- Consumes: Task 1 토큰 클래스, Task 3 `HorizonDivider`
- Produces: 없음 (최종 페이지, leaf)

- [ ] **Step 1: `app/page.tsx` 전체를 아래 내용으로 교체**

```tsx
import Link from "next/link";
import { Suspense } from "react";
import WeatherWidget from "@/components/WeatherWidget";
import HorizonDivider from "@/components/HorizonDivider";

const DAY_FLOW = [
  {
    eyebrow: "01",
    title: "일하기",
    description: "카페·코워킹·도서관 230+곳 중에서 소음도, 콘센트 여부로 필터링해 딱 맞는 곳을 찾으세요.",
    href: "/spots",
    cta: "워크스팟 보기",
  },
  {
    eyebrow: "02",
    title: "먹기",
    description: "한국관광공사 공식 데이터로 확인한 강릉 현지 맛집 30곳.",
    href: "/food",
    cta: "맛집 보기",
  },
  {
    eyebrow: "03",
    title: "즐기기",
    description: "관광지·전망 명소를 지도에서 한눈에.",
    href: "/map",
    cta: "지도 보기",
  },
  {
    eyebrow: "04",
    title: "축제",
    description: "강릉단오제 등 지역 축제·행사 일정을 관광공사 공식 데이터로 미리 확인하세요.",
    href: "/events",
    cta: "행사 보기",
  },
  {
    eyebrow: "05",
    title: "자기",
    description: "한국관광공사 공식 데이터 기반 호텔·펜션·게스트하우스 정보.",
    href: "/stay",
    cta: "숙박 보기",
  },
];

const ENABLERS = [
  {
    eyebrow: "AI 큐레이터",
    title: "AI가 짜주는 하루 워케이션 동선",
    description: "업무 스타일과 시간을 입력하면 AI가 최적의 이동 동선과 장소를 큐레이션합니다.",
    href: "/ai-curator",
    cta: "동선 만들기",
  },
  {
    eyebrow: "데이터 신뢰성",
    title: "전화 확인·방문으로 검증한 정보만",
    description: "24곳은 전화 확인과 방문으로 WiFi·콘센트·소음을 직접 검증했습니다. 확인되지 않은 정보는 추정하지 않고 '미확인'으로 표시합니다.",
    href: "/spots",
    cta: "검증된 스팟 보기",
  },
  {
    eyebrow: "플래너",
    title: "내 동선 저장하고 공유하기",
    description: "AI 큐레이터 추천 동선을 저장해 언제든 꺼내보고 링크로 공유하세요.",
    href: "/planner",
    cta: "플래너 열기",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 히어로 — 라이트/다크 공용 짙은 톤 */}
      <section className="relative overflow-hidden min-h-[88vh] flex items-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))]">
        <div className="relative max-w-6xl mx-auto px-4 py-24 w-full">
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-semibold tracking-widest text-white/80 uppercase mb-6">
              Gangneung Workation Platform
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-tight mb-6">
              바다 앞에서<br />
              <span className="text-white drop-shadow">일하세요.</span>
            </h1>
            <p className="text-lg text-white/85 mb-10 max-w-xl leading-relaxed">
              일할 공간부터 맛집, 숙박까지 — 한국관광공사 공식 데이터와 AI가
              강릉 워케이션의 모든 동선을 설계합니다.
            </p>
            <div className="flex flex-wrap gap-4 mb-8">
              <Link
                href="/ai-curator"
                className="px-7 py-4 bg-white text-primary rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors shadow-lg shadow-black/10"
              >
                AI 동선 만들기
              </Link>
              <Link
                href="/spots"
                className="px-7 py-4 bg-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/30 transition-colors border border-white/40"
              >
                워크스팟 둘러보기
              </Link>
            </div>
            <Suspense fallback={null}>
              <WeatherWidget />
            </Suspense>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 text-white/15">
          <HorizonDivider />
        </div>
      </section>

      {/* 스탯 배너 */}
      <section className="bg-background border-b border-border py-10">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-4xl font-bold text-foreground">230<span className="text-accent">+</span></p>
            <p className="text-sm text-foreground/60 mt-1">강릉 워크스팟</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-foreground">6<span className="text-primary">종</span></p>
            <p className="text-sm text-foreground/60 mt-1">관광공사 API 활용</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-foreground">24<span className="text-accent">곳</span></p>
            <p className="text-sm text-foreground/60 mt-1">실측 검증 완료</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary">AI</p>
            <p className="text-sm text-foreground/60 mt-1">맞춤 동선 큐레이션</p>
          </div>
        </div>
      </section>

      {/* 강릉에서의 하루 (시간 흐름 5스텝) */}
      <section className="py-16 bg-muted">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">강릉에서의 하루</h2>
            <p className="text-foreground/60 text-sm">워케이션의 모든 순간을 하나의 플랫폼에서</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {DAY_FLOW.map((item) => (
              <SectionCard key={item.eyebrow} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* 이걸 가능하게 하는 것 (도구/신뢰 요소 3개) */}
      <section className="py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-accent uppercase mb-4">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 3v2M12 3c-2 2-2 4 0 6s2 4 0 6M8 8c1 1 1 2 0 3M16 8c-1 1-1 2 0 3" strokeLinecap="round" />
              </svg>
              Why Gangneung Node
            </span>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              이걸 가능하게 하는 것
            </h2>
            <p className="text-foreground/60 max-w-lg mx-auto">
              한국관광공사 공식 OpenAPI 데이터 · AI 동선 최적화 · 전화·방문으로 실측 검증한 워크스팟 정보
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ENABLERS.map((item) => (
              <SectionCard key={item.eyebrow} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* 강릉 소개 배너 — 라이트/다크 공용 짙은 톤 */}
      <section className="relative overflow-hidden py-20 bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))]">
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <p className="text-white/70 text-sm font-semibold tracking-widest uppercase mb-4">Why Gangneung</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            왜 강릉인가요?
          </h2>
          <p className="text-white/85 leading-relaxed max-w-2xl mx-auto mb-10">
            서울에서 KTX로 2시간, 동해 바다와 백두대간이 공존하는 강릉.
            스페셜티 커피 문화와 넓은 카페 문화권, 그리고 빠른 인터넷 인프라로
            디지털 노마드에게 최적의 환경을 제공합니다.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { value: "2시간", label: "서울 → KTX" },
              { value: "230+", label: "워크스팟" },
              { value: "기가", label: "인터넷 인프라" },
              { value: "365일", label: "워케이션 가능" },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-2xl p-4 border border-white/10">
                <p className="text-2xl font-bold text-white">{item.value}</p>
                <p className="text-xs text-white/70 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute top-0 left-0 right-0 rotate-180 text-white/10">
          <HorizonDivider />
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="bg-background py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            오늘의 강릉 동선, AI에게 맡겨보세요
          </h2>
          <p className="text-foreground/60 mb-8">
            업무 스타일과 선호를 입력하면 AI가 워크스팟부터 맛집·관광지까지<br className="hidden sm:block" />
            최적 이동 동선으로 하루를 설계해드립니다.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/ai-curator"
              className="inline-block px-8 py-4 bg-accent text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              AI 동선 만들기
            </Link>
            <Link
              href="/planner"
              className="inline-block px-8 py-4 border border-border text-foreground rounded-xl font-semibold text-sm hover:border-primary transition-colors"
            >
              내 플래너 보기
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-muted border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-bold text-foreground">강릉 노드</p>
          <p className="text-xs text-foreground/60">
            본 서비스는 한국관광공사 공공 데이터를 활용합니다.
          </p>
          <div className="flex flex-wrap gap-5 text-sm text-foreground/70">
            <Link href="/spots" className="hover:text-foreground transition-colors">워크스팟</Link>
            <Link href="/stay" className="hover:text-foreground transition-colors">숙박</Link>
            <Link href="/food" className="hover:text-foreground transition-colors">맛집</Link>
            <Link href="/events" className="hover:text-foreground transition-colors">행사/축제</Link>
            <Link href="/ai-curator" className="hover:text-foreground transition-colors">AI 큐레이터</Link>
            <Link href="/map" className="hover:text-foreground transition-colors">지도</Link>
            <Link href="/planner" className="hover:text-foreground transition-colors">플래너</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  href,
  cta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-background rounded-2xl border border-border p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3"
    >
      <span className="text-xs font-bold tracking-widest text-accent">{eyebrow}</span>
      <div>
        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-sm text-foreground/60 mt-2 leading-relaxed">{description}</p>
      </div>
      <span className="text-sm font-semibold text-primary mt-auto">{cta} →</span>
    </Link>
  );
}
```

기존 `FeatureCard`(색상별 `colorMap` 객체, 7개 하드코딩 분기)와 플로우 섹션의 `text-${item.color}-500` 동적 클래스 보간(Tailwind가 빌드 타임에 정적 분석하지 못하는 패턴, 잠재적 버그)을 모두 제거하고 `SectionCard` 하나로 통합했다 — 두 섹션(DAY_FLOW/ENABLERS) 모두 같은 컴포넌트를 쓰므로 `eyebrow` 자리에 "01" 같은 스텝 번호 또는 "AI 큐레이터" 같은 태그 텍스트가 그대로 들어간다.

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint app/page.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: WiFi 속도 문구 잔존 여부 확인**

Run: `grep -n "WiFi 속도\|와이파이 속도" app/page.tsx`
Expected: 결과 없음 (exit code 1)

- [ ] **Step 4: 로컬 서버로 실제 렌더 확인**

Run:
```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
curl -s http://localhost:3000 | grep -o "강릉에서의 하루\|이걸 가능하게 하는 것\|왜 강릉인가요" | sort -u
```
Expected: `200`, 세 문자열 모두 응답 HTML에 존재(새 섹션 구조가 실제로 렌더링됨).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: 홈페이지 컬러/타이포/레이아웃 리디자인, WiFi 속도 문구 제거"
```

---

## Task 6: 최종 검증 (전체 라운드)

**Files:** 없음 (검증 전용, 파일 변경 없음)

**Interfaces:** 없음

- [ ] **Step 1: 전체 타입체크 + lint**

Run: `npx tsc --noEmit && npx eslint app/page.tsx app/layout.tsx components/NavMenu.tsx components/HorizonDivider.tsx lib/theme.ts app/globals.css`
Expected: 전부 에러 0건

- [ ] **Step 2: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공, `app/page.tsx`/`app/layout.tsx` 관련 에러·경고 없음

- [ ] **Step 3: 반응형 3개 뷰포트 육안 확인 (로컬 브라우저)**

`npm run dev` 상태에서 브라우저 개발자도구로 375px / 768px / 1440px 각각에서 홈페이지 확인. 확인 항목: 히어로 텍스트 줄바꿈 이상 없음, `DAY_FLOW` 그리드(`grid-cols-2 sm:grid-cols-5`)가 모바일에서 2열로 정상 wrap, `ENABLERS` 그리드(`md:grid-cols-3`)가 모바일에서 1열로 쌓임.

- [ ] **Step 4: 다크모드 대비 육안 확인**

토글을 다크로 전환한 상태에서 스탯 배너 숫자(`text-foreground` on `bg-background`), 카드 설명문(`text-foreground/60`)이 배경과 구분 가능한 대비를 유지하는지 확인. 부족하면 이 단계에서 `app/globals.css`의 다크 토큰 값을 미세 조정한다(예: `--color-foreground` 다크값을 더 밝게).

- [ ] **Step 5: 회귀 확인**

홈페이지의 모든 링크(히어로 2개, `DAY_FLOW` 5개, `ENABLERS` 3개, 하단 CTA 2개, 푸터 7개)가 각각 올바른 경로로 라우팅되는지 클릭 확인 — 이번 라운드에서 대상 페이지 자체는 안 건드렸으므로 404나 깨진 링크가 없어야 정상.

- [ ] **Step 6: 최종 커밋 (필요 시)**

Step 4에서 토큰 값을 조정했다면:
```bash
git add app/globals.css
git commit -m "fix: 다크모드 텍스트 대비 조정"
```
조정이 없었다면 이 스텝은 생략.
