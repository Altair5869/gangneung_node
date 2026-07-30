# AI 큐레이터 페이지 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/ai-curator` 페이지(`app/ai-curator/page.tsx`)와 이 페이지 전용 인라인 지도(`components/map/RouteMap.tsx`)를 홈페이지·스팟 라운드에서 만든 컬러 토큰 체계로 리스킨하고 다크모드를 지원한다.

**Architecture:** 신규 토큰 없음 — 기존 `app/globals.css`의 `primary`/`primary-dark`/`hero-glow`/`accent`/`background`/`foreground`/`muted`/`border`/`good`/`warn`/`bad`/`on-good`/`on-primary`/`on-accent` 토큰과 `lib/spot-visuals.ts`의 `categoryGradient`/`noiseBadge`/`powerBadge`/`congestionStyle`/`categoryLabel` 헬퍼를 그대로 재사용한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. 신규 의존성 없음.

## Global Constraints

- 이번 라운드는 `app/ai-curator/page.tsx`, `components/map/RouteMap.tsx`만 대상이다 — `/map`, `/planner`, `/food`, `/stay`, `/events`는 범위 밖이다.
- 프로젝트에 테스트 프레임워크가 없다 — 각 태스크의 검증은 `npx tsc --noEmit`, `npx eslint`, `next dev` 로컬 실행 후 `curl`/육안 확인으로 대체한다.
- Step 폼 구조, 결과 카드 배치, AI 큐레이션 로직(`handleSubmit`, `/api/ai/curate` 호출)은 절대 변경하지 않는다 — 이번 라운드는 순수 시각적 리스킨이다.
- `bg-{good,warn,bad}/15 text-{token}` 반투명 배지는 `bg-background` 위에서만 스팟 라운드에서 WCAG AA 검증이 완료됐다 — 이 페이지의 배경 블롭 장식(`bg-sky-100/60` 등)을 제거해 실제 배경이 `bg-background`가 되게 하는 것이 선행 조건이다.
- 카카오맵 캔버스 내부(마커/폴리라인)는 다크모드 대상이 아니다 — 지도 타일 자체가 다크 테마를 지원하지 않으므로 항상 라이트 모드 hex 값을 유지한다. 캔버스 밖 UI(로딩/에러 placeholder, 범례 pill)만 토큰 클래스로 다크모드를 지원한다.
- **설계 문서 대비 보정 사항 (self-review에서 발견):** 설계 문서는 결과 설명 카드 그라디언트를 `from-primary to-primary-dark`로 명시했으나, `primary` 토큰은 다크모드에서 밝은 색(`#35C9B8`)으로 바뀌어 흰 텍스트(`text-white`)와 대비가 무너진다. 이 카드는 헤더 배너와 동일한 "모드 불변 히어로 톤" 요소이므로, 헤더 배너와 똑같이 `primary-dark`+`hero-glow` 조합(두 값 모두 라이트/다크 동일)을 쓰고 텍스트는 고정 `text-white`/`text-white/70`을 유지한다. 반면 Step 활성 버튼·제출 버튼처럼 브랜드 색 자체를 강조해야 하는 인터랙티브 요소는 `primary`/`accent`를 그대로 쓰되 텍스트는 `text-on-primary`/`text-on-accent`를 사용해 모드별 대비를 보정한다.
- Step1(업무 스타일)/Step2 소요시간 버튼은 원래 `sky`(파랑) 톤이었고 Step2 시작시간/Step3 선호조건 버튼은 원래 `teal`(청록) 톤이었다 — 이 두 그룹의 시각적 구분을 유지하기 위해 전자는 `primary`, 후자는 `accent` 토큰으로 매핑한다(설계 문서의 "Step 활성 버튼 → bg-primary" 서술을 이 구분에 맞게 세분화).

---

## Task 1: 인라인 지도 컬러 토큰 리스킨 (`components/map/RouteMap.tsx`)

**Files:**
- Modify: `components/map/RouteMap.tsx` (전체 139줄 교체)

**Interfaces:**
- Consumes: 없음 (props `stops: RouteStop[]`는 변경 없음)
- Produces: 없음 (leaf 컴포넌트). `WORK_COLOR`/`LIFE_COLOR` 상수값이 Task 2의 결과 목록 번호 원 색상(`bg-primary`/`bg-accent`)과 시각적으로 일치해야 한다 — 둘 다 "워크스팟=primary(teal), 라이프스팟=accent(rust)"라는 동일한 의미 매핑을 쓴다.

- [ ] **Step 1: `components/map/RouteMap.tsx` 전체를 아래 내용으로 교체**

```tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { RouteStop, isLifeSpot } from "@/types";

const WORK_COLOR = "#0F6B62";
const LIFE_COLOR = "#B8511E";

export default function RouteMap({ stops }: { stops: RouteStop[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;
    let timeoutTimer: ReturnType<typeof setTimeout>;

    async function initMap() {
      if (!mapRef.current || stops.length === 0) { setStatus("ready"); return; }
      try {
        const avgLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
        const avgLng = stops.reduce((s, p) => s + p.lng, 0) / stops.length;
        const center = new window.kakao.maps.LatLng(avgLat, avgLng);
        const map = new window.kakao.maps.Map(mapRef.current, { center, level: 7 });

        stops.forEach((stop, i) => {
          const pos = new window.kakao.maps.LatLng(stop.lat, stop.lng);
          const color = isLifeSpot(stop) ? LIFE_COLOR : WORK_COLOR;

          const el = document.createElement("div");
          el.style.cssText = `background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;`;
          el.textContent = String(i + 1);

          new window.kakao.maps.CustomOverlay({
            map,
            position: pos,
            content: el,
            yAnchor: 1.5,
            zIndex: 3,
          });
        });

        // 실제 도로 기반 경로를 시도하고, 실패하면 직선으로 대체한다.
        let roadPoints: { lat: number; lng: number }[] = [];
        try {
          const res = await fetch("/api/directions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ points: stops.map((s) => ({ lat: s.lat, lng: s.lng })) }),
          });
          if (res.ok) {
            const data = (await res.json()) as { path: { lat: number; lng: number }[] };
            roadPoints = data.path ?? [];
          }
        } catch {
          // 무시하고 직선 fallback 사용
        }

        const linePath =
          roadPoints.length > 1
            ? roadPoints.map((p) => new window.kakao.maps.LatLng(p.lat, p.lng))
            : stops.map((s) => new window.kakao.maps.LatLng(s.lat, s.lng));

        if (linePath.length > 1) {
          new window.kakao.maps.Polyline({
            map,
            path: linePath,
            strokeWeight: 3,
            strokeColor: WORK_COLOR,
            strokeOpacity: 0.6,
            strokeStyle: "solid",
          });
        }

        const bounds = new window.kakao.maps.LatLngBounds();
        stops.forEach((s) => bounds.extend(new window.kakao.maps.LatLng(s.lat, s.lng)));
        map.setBounds(bounds);

        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }

    function startPolling() {
      pollTimer = setInterval(() => {
        if (!window.kakao?.maps) return;
        clearInterval(pollTimer);
        window.kakao.maps.load(initMap);
      }, 100);
      timeoutTimer = setTimeout(() => {
        clearInterval(pollTimer);
        setStatus("error");
      }, 10000);
    }

    if (window.kakao?.maps) { window.kakao.maps.load(initMap); return; }
    if (document.querySelector('script[src*="dapi.kakao.com"]')) { startPolling(); return; }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`;
    script.onload = startPolling;
    script.onerror = () => { clearTimeout(timeoutTimer); setStatus("error"); };
    document.head.appendChild(script);

    return () => { clearInterval(pollTimer); clearTimeout(timeoutTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: 300 }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-foreground/60 text-sm">지도 불러오는 중...</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-foreground/60 text-sm">지도를 불러올 수 없습니다</p>
        </div>
      )}

      {status === "ready" && (
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow text-xs flex gap-3">
          <span className="flex items-center gap-1.5 text-foreground">
            <span className="w-3 h-3 rounded-full inline-block bg-primary" />
            워크스팟
          </span>
          <span className="flex items-center gap-1.5 text-foreground">
            <span className="w-3 h-3 rounded-full inline-block bg-accent" />
            라이프스팟
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint components/map/RouteMap.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 하드코딩 색상 잔존 확인**

Run: `grep -nE "gray-[0-9]|sky-[0-9]|teal-[0-9]|blue-[0-9]|white/9" components/map/RouteMap.tsx`
Expected: 결과 없음 (exit code 1)

- [ ] **Step 4: Commit**

```bash
git add components/map/RouteMap.tsx
git commit -m "feat: RouteMap 컬러 토큰 리스킨"
```

---

## Task 2: AI 큐레이터 페이지 리스킨 (`app/ai-curator/page.tsx`)

**Files:**
- Modify: `app/ai-curator/page.tsx` (전체 466줄 교체)

**Interfaces:**
- Consumes: Task 1의 `RouteMap`(기존 import·props 그대로), `lib/spot-visuals.ts`의 `categoryGradient`/`noiseBadge`/`powerBadge`/`congestionStyle`/`categoryLabel as workCategoryLabel`
- Produces: 없음 (leaf 페이지)

**로컬 라벨맵 병합 방침:** `lib/spot-visuals.ts`의 `categoryLabel`은 워크스팟 카테고리(`cafe`/`coworking`/`library`/`hotel`/`other`)만 커버한다. 이 페이지는 결과 목록에 라이프스팟(`attraction`/`food`)도 섞여 나오므로, `workCategoryLabel`을 import하고 라이프스팟 전용 라벨을 페이지 로컬에서 병합한다.

- [ ] **Step 1: `app/ai-curator/page.tsx` 전체를 아래 내용으로 교체**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { WorkSpot, LifeSpot, CurationRoute, isLifeSpot } from "@/types";
import { cn, congestionLabel, isBarrierFree } from "@/lib/utils";
import { categoryLabel as workCategoryLabel, congestionStyle } from "@/lib/spot-visuals";
import RouteMap from "@/components/map/RouteMap";
import { savePlan } from "@/lib/planner-storage";

const WORK_STYLES = [
  { value: "집중 코딩/개발 작업", label: "집중 개발", desc: "코딩·디버깅·집중 작업" },
  { value: "문서 작업 및 기획", label: "문서·기획", desc: "글쓰기·기획·보고서" },
  { value: "화상 미팅 및 회의", label: "화상 미팅", desc: "온라인 회의·인터뷰" },
  { value: "창의적 작업 및 아이디어 발산", label: "크리에이티브", desc: "디자인·브레인스토밍" },
];

const PREFERENCE_OPTIONS = [
  { value: "조용한 환경", label: "조용함" },
  { value: "콘센트 필수", label: "콘센트" },
  { value: "뷰 좋은 곳", label: "뷰 맛집" },
  { value: "카페인 충전 가능", label: "커피" },
  { value: "무장애 접근 가능", label: "무장애" },
];

const DURATION_OPTIONS = [2, 4, 6, 8];

const START_TIME_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: "선택 안 함" },
  { value: 9, label: "오전 9시" },
  { value: 13, label: "오후 1시" },
  { value: 18, label: "오후 6시" },
];

const lifeCategoryLabel: Record<string, string> = {
  attraction: "관광지",
  food: "식당",
};

const categoryLabel: Record<string, string> = { ...workCategoryLabel, ...lifeCategoryLabel };

export default function AiCuratorPage() {
  const [workStyle, setWorkStyle] = useState(WORK_STYLES[0].value);
  const [duration, setDuration] = useState(4);
  const [startHour, setStartHour] = useState<number | undefined>(undefined);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CurationRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);

  const togglePreference = (value: string) => {
    setPreferences((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const spotsUrl = startHour !== undefined ? `/api/spots?startHour=${startHour}` : "/api/spots";
      const [spotsRes, lifeSpotsRes, foodSpotsRes] = await Promise.all([
        fetch(spotsUrl),
        fetch("/api/life-spots"),
        fetch("/api/food-spots"),
      ]);
      const { spots } = (await spotsRes.json()) as { spots: WorkSpot[] };
      const { spots: attractionSpots } = (await lifeSpotsRes.json()) as { spots: LifeSpot[] };
      const { spots: foodSpots } = (await foodSpotsRes.json()) as { spots: LifeSpot[] };
      const lifeSpots = [...attractionSpots, ...foodSpots];

      const res = await fetch("/api/ai/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curationRequest: { workStyle, duration, preferences, freeText: freeText.trim() || undefined, startHour },
          spots,
          lifeSpots,
        }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { route: CurationRoute };
      setResult(data.route);
      setShowSaveForm(false);
      setSavedPlanId(null);
      setPlanName(`강릉 워케이션 ${new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`);
    } catch {
      setError("AI 큐레이터 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">

      {/* 헤더 배너 — 라이트/다크 공용 짙은 톤 (홈페이지 히어로와 동일 패턴) */}
      <section className="bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] py-12">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">AI Curator</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">AI 동선 큐레이터</h1>
          <p className="text-white/70 text-sm">
            업무 스타일을 알려주시면 강릉 최적 워크-라이프 동선을 추천해드립니다.
          </p>
        </div>
      </section>

      <div className="relative flex-1 bg-background">

      <div className="relative max-w-3xl mx-auto px-4 py-10 w-full">

        {/* 입력 폼 */}
        <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden">

          {/* Step 1 — 업무 스타일 */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Step 1</p>
            <label className="text-base font-bold text-foreground block mb-4">오늘의 업무 스타일</label>
            <div className="grid grid-cols-2 gap-2">
              {WORK_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setWorkStyle(s.value)}
                  className={cn(
                    "px-4 py-3 rounded-xl text-left border transition-all",
                    workStyle === s.value
                      ? "bg-primary text-on-primary border-primary shadow-md shadow-primary/20"
                      : "bg-muted text-foreground/70 border-border hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className={cn("text-xs mt-0.5", workStyle === s.value ? "text-on-primary/70" : "text-foreground/40")}>
                    {s.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — 업무 시간 */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Step 2</p>
            <label className="text-base font-bold text-foreground block mb-4">업무 예정 시간</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setDuration(h)}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-bold border transition-all",
                    duration === h
                      ? "bg-primary text-on-primary border-primary shadow-md shadow-primary/20"
                      : "bg-muted text-foreground/60 border-border hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  {h}시간
                </button>
              ))}
            </div>

            <label className="text-sm font-semibold text-foreground/70 block mt-5 mb-3">
              시작 시간
              <span className="ml-2 text-xs font-normal text-foreground/40">선택 — 혼잡도 예측과 예상 일정표에 반영됩니다</span>
            </label>
            <div className="flex gap-2">
              {START_TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setStartHour(opt.value)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all",
                    startHour === opt.value
                      ? "bg-accent text-on-accent border-accent shadow-sm"
                      : "bg-muted text-foreground/60 border-border hover:border-accent/40 hover:bg-accent/5"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3 — 선호도 */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Step 3</p>
            <label className="text-base font-bold text-foreground block mb-4">
              선호 조건
              <span className="ml-2 text-xs font-normal text-foreground/40">복수 선택 가능</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PREFERENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => togglePreference(opt.value)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                    preferences.includes(opt.value)
                      ? "bg-accent text-on-accent border-accent shadow-sm"
                      : "bg-muted text-foreground/60 border-border hover:border-accent/40 hover:bg-accent/5"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 4 — 자유 텍스트 */}
          <div className="p-6 border-b border-border">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Step 4</p>
            <label className="text-base font-bold text-foreground block mb-4">
              자유롭게 원하는 조건을 알려주세요
              <span className="ml-2 text-xs font-normal text-foreground/40">선택</span>
            </label>
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="예: 바다 보이는 조용한 카페, 노트북 작업하기 좋은 곳"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* 제출 버튼 */}
          <div className="p-6">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={cn(
                "w-full py-4 rounded-xl text-sm font-bold transition-all",
                loading
                  ? "bg-muted text-foreground/40 cursor-not-allowed"
                  : "bg-gradient-to-r from-primary to-accent text-on-primary hover:opacity-90 shadow-lg shadow-primary/20"
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-border border-t-foreground/50 rounded-full animate-spin" />
                  AI가 동선을 구성 중입니다...
                </span>
              ) : (
                "AI 동선 추천받기"
              )}
            </button>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="mt-6 p-4 bg-bad/15 border border-bad/30 rounded-2xl text-sm text-bad">
            {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div className="mt-8 space-y-6">

            {/* 검증 실패 경고 배너 */}
            {result.validationNote && (
              <div className="p-4 bg-warn/15 border border-warn/30 rounded-2xl text-sm text-warn">
                {result.validationNote}
              </div>
            )}

            {/* 동선 설명 카드 — 라이트/다크 공용 짙은 톤 (헤더 배너와 동일 패턴) */}
            <div className="bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] rounded-2xl p-6 text-white shadow-xl">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-3">AI 추천 워크-라이프 동선</p>
              <p className="text-base leading-relaxed">{result.description}</p>
              <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                <span className="text-sm text-white/60">총 일정</span>
                <span className="text-sm font-bold text-white">{result.totalDuration}시간</span>
              </div>
            </div>

            {/* 예상 일정표 */}
            {result.schedule && result.schedule.length > 0 && (
              <div className="bg-background border border-border rounded-2xl p-5">
                <h2 className="text-sm font-bold text-foreground mb-3">예상 일정표</h2>
                <ul className="space-y-2">
                  {result.schedule.map((line, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 인라인 지도 */}
            <RouteMap stops={result.spots} />

            {/* 추천 장소 */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">추천 동선</h2>
              <div className="space-y-3">
                {result.spots.map((spot, i) => {
                  const life = isLifeSpot(spot);
                  const card = (
                    <div className="flex gap-4 bg-background border border-border rounded-2xl p-4 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200">
                      {/* 순번 */}
                      <div
                        className={cn(
                          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm",
                          life ? "bg-accent text-on-accent" : "bg-primary text-on-primary"
                        )}
                      >
                        {i + 1}
                      </div>

                      {/* 썸네일 */}
                      {spot.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={spot.imageUrl}
                          alt={spot.name}
                          className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex-shrink-0" />
                      )}

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {spot.name}
                        </p>
                        <p className="text-xs text-foreground/60 mt-0.5 truncate">{spot.address}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              life ? "bg-accent/15 text-accent" : "bg-muted text-foreground/60"
                            )}
                          >
                            {categoryLabel[spot.category] ?? spot.category}
                          </span>
                          {!life && (
                            <>
                              {(spot as WorkSpot).wifi.available && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-good/15 text-good font-medium">
                                  WiFi
                                </span>
                              )}
                              {isBarrierFree((spot as WorkSpot).barrierFree) && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-good/15 text-good font-medium">
                                  무장애
                                </span>
                              )}
                              {(spot as WorkSpot).congestion && (
                                <span className="flex items-center gap-1 text-xs text-foreground/60">
                                  <span className={cn("w-1.5 h-1.5 rounded-full", congestionStyle[(spot as WorkSpot).congestion!].dot)} />
                                  예상 {congestionLabel((spot as WorkSpot).congestion)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  return life ? (
                    <div key={spot.id}>{card}</div>
                  ) : (
                    <Link key={spot.id} href={`/spots/${spot.id}`} className="block group">
                      {card}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 워케이션 팁 */}
            {result.tips.length > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-primary mb-3">워케이션 팁</h2>
                <ul className="space-y-2.5">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="flex gap-3 text-sm text-primary">
                      <span className="flex-shrink-0 w-5 h-5 bg-primary text-on-primary rounded-full flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 동선 저장 */}
            {!savedPlanId ? (
              <div className="bg-muted border border-border rounded-2xl p-5">
                {!showSaveForm ? (
                  <button
                    onClick={() => setShowSaveForm(true)}
                    className="w-full py-3 rounded-xl text-sm font-semibold bg-foreground text-background hover:opacity-80 transition-opacity"
                  >
                    이 동선 플래너에 저장하기
                  </button>
                ) : (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">플랜 이름</label>
                    <input
                      type="text"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                      placeholder="강릉 워케이션 동선 이름을 입력하세요"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!result || !planName.trim()) return;
                          const plan = savePlan(planName.trim(), result);
                          setSavedPlanId(plan.id);
                          setShowSaveForm(false);
                        }}
                        disabled={!planName.trim()}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setShowSaveForm(false)}
                        className="px-5 py-3 rounded-xl text-sm font-semibold border border-border text-foreground/60 hover:border-foreground/40 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-good/15 border border-good/30 rounded-2xl p-5 flex items-center justify-between">
                <p className="text-sm font-semibold text-good">플래너에 저장되었습니다</p>
                <Link
                  href="/planner"
                  className="text-sm font-bold text-good hover:opacity-80 underline"
                >
                  플래너 보기
                </Link>
              </div>
            )}

            {/* 다시 시작 */}
            <button
              onClick={() => { setResult(null); setPreferences([]); setFreeText(""); setStartHour(undefined); setSavedPlanId(null); setShowSaveForm(false); }}
              className="w-full py-3 rounded-xl text-sm font-semibold text-foreground/60 border border-border hover:border-foreground/40 hover:text-foreground transition-all"
            >
              다시 추천받기
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint app/ai-curator/page.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 하드코딩 색상 잔존 확인**

Run: `grep -nE "gray-[0-9]|sky-[0-9]|teal-[0-9]|blue-[0-9]|amber-[0-9]|red-[0-9]|green-[0-9]" app/ai-curator/page.tsx`
Expected: 결과 없음 — 단, 결과 설명 카드와 헤더 배너의 `text-white`/`text-white/70`/`border-white/20`은 의도적으로 유지되는 모드 불변 히어로 톤이므로 이 grep 패턴에는 안 걸림(별도 확인 불필요)

- [ ] **Step 4: 렌더 + 폼 마크업 확인 (로컬 서버)**

Run:
```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/ai-curator
curl -s http://localhost:3000/ai-curator | grep -o "AI 동선 큐레이터\|오늘의 업무 스타일\|자유롭게 원하는 조건" | sort -u
```
Expected: 첫 줄 `200`, 두 번째 명령 결과에 3개 문구 모두 존재 — 폼 마크업이 안 깨졌는지 확인

- [ ] **Step 5: Commit**

```bash
git add app/ai-curator/page.tsx
git commit -m "feat: AI 큐레이터 페이지 컬러 토큰 리스킨, 다크모드 지원"
```

---

## Task 3: 최종 검증

**Files:** 없음 (검증 전용)

**Interfaces:** 없음

- [ ] **Step 1: 전체 타입체크 + lint**

Run: `npx tsc --noEmit && npx eslint app/ai-curator/page.tsx components/map/RouteMap.tsx`
Expected: 전부 에러 0건

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공, 관련 파일 에러 0건

- [ ] **Step 3: 신규 조합 대비 확인**

이 라운드가 새로 도입한 배지 색 조합은 없다(`bg-good/15`/`bg-warn/15`/`bg-bad/15`/`bg-accent/15`는 스팟 라운드에서 이미 `bg-background` 배경 기준 AA 검증 완료, `bg-primary/10 text-primary`는 `WorkEnvScore.tsx`에서 이미 쓰인 패턴). 단 아래 2개는 이 페이지에서 처음 조합되므로 육안 확인한다:
- 결과 목록 번호 원의 `bg-accent text-on-accent`(라이프스팟) — 스팟 라운드에서는 `on-accent`가 실사용된 적 없었음(설계 당시 무장애 배지 등에서 `on-good`만 실사용). 라이트/다크 각각 렌더링해 텍스트가 잘 보이는지 확인
- 제출 버튼의 `from-primary to-accent` 그라디언트 위 `text-on-primary` — 그라디언트 양 끝 색 모두에서 텍스트 대비가 유지되는지 라이트/다크 각각 육안 확인

- [ ] **Step 4: 폼 인터랙션 회귀 확인 (로컬 브라우저, 가능한 경우)**

`next dev` 상태에서 `/ai-curator`를 열어 Step 1~4를 실제로 클릭/입력하고 "AI 동선 추천받기" 제출 후 결과 카드(설명/일정표/지도/추천 장소/팁/저장 플로우)가 정상 렌더되는지 확인한다. 브라우저 도구가 없는 환경이면 이 스텝은 "코드 레벨 확인만, 브라우저 실행 재현 아님"으로 명시하고 건너뛴다.

- [ ] **Step 5: 다크모드 토글 실측 (로컬 브라우저, 가능한 경우)**

다크 토글 전환 후 헤더 배너·Step 버튼·에러/경고/성공 배너·결과 카드가 전부 자연스럽게 전환되는지 육안 확인. Step 3과 마찬가지로 브라우저 도구가 없으면 생략하고 명시한다.

- [ ] **Step 6: 최종 커밋 (필요 시)**

Step 3~5에서 대비 미달이나 마크업 문제를 발견해 코드를 수정했다면:
```bash
git add app/ai-curator/page.tsx components/map/RouteMap.tsx
git commit -m "fix: AI 큐레이터 리스킨 대비/렌더 이슈 수정"
```
문제가 없었다면 이 스텝은 생략.
