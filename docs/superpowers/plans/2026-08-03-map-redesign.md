# /map 페이지 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/map` 페이지의 지도 컴포넌트(`components/map/KakaoMap.tsx`)와 스팟 카드(`components/map/MapSpotCard.tsx`)를 홈페이지·스팟·AI 큐레이터 라운드에서 만든 컬러 토큰 체계로 리스킨하고 다크모드를 지원한다.

**Architecture:** 신규 토큰 없음 — 기존 `app/globals.css`의 `primary`/`accent`/`background`/`foreground`/`muted`/`border`/`good`/`warn`/`bad`/`on-primary`/`on-accent` 토큰과 `lib/spot-visuals.ts`의 `categoryLabel`/`noiseBadge`/`powerBadge` 헬퍼를 재사용한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. 신규 의존성 없음.

## Global Constraints

- 이번 라운드는 `components/map/KakaoMap.tsx`, `components/map/MapSpotCard.tsx`만 대상이다 — `app/map/page.tsx`, `app/map/loading.tsx`는 2026-08-01 백지화면 지연 수정(`10d8c57`)에서 이미 토큰 클래스로 작성되어 있어 대상 밖. `components/spots/SpotFilter.tsx`도 같은 하드코딩 패턴이 남아있지만 사용자 결정으로 범위 밖(후속 라운드 후보).
- 프로젝트에 테스트 프레임워크가 없다 — 각 태스크의 검증은 `npx tsc --noEmit`, `npx eslint`, `next dev` 로컬 실행 후 `curl`/육안 확인으로 대체한다.
- 필터 패널 위치·구조, `MapSpotCard`의 바텀시트 위치·구조, 지도 마커 렌더링 로직(`initMap`, 오버레이 생성)은 절대 변경하지 않는다 — 이번 라운드는 순수 시각적 리스킨이다.
- 혼잡도 마커 색(`CONGESTION_COLOR` 상수)과 필터 패널 범례 dot(`bg-green-400`/`bg-yellow-400`/`bg-red-400`/`bg-gray-400`)은 토큰화하지 않는다 — 마커가 카카오맵 캔버스 내부에 고정 hex로 렌더되어 CSS 커스텀 프로퍼티가 적용되지 않기 때문(`RouteMap.tsx` 라운드에서 확인된 제약, 설계 문서에 명시).
- **설계 문서 대비 보정 사항 (계획 작성 중 발견):** 설계 문서는 `MapSpotCard.tsx`의 로컬 `congestionDot` 정의를 `lib/spot-visuals.ts`의 `congestionStyle`(good/warn/bad 토큰) import로 교체하는 것처럼 서술했으나, 이렇게 하면 사용자가 방금 클릭한 마커(캔버스 내부 고정 hex, 위 항목 참고)와 카드에 뜨는 혼잡도 dot 색이 다크모드에서 서로 달라진다. 같은 스팟의 같은 혼잡도를 두 곳에서 다르게 색칠하는 회귀이므로, `congestionDot`은 `MapSpotCard.tsx`에 로컬로 그대로 남기고(값 불변: `low: "bg-green-400"`, `medium: "bg-yellow-400"`, `high: "bg-red-400"`) `congestionStyle`은 import하지 않는다. `categoryLabel`/`noiseBadge`/`powerBadge`는 계획대로 `lib/spot-visuals.ts`에서 import한다(이 셋은 마커 색과 무관한 배지라 토큰화해도 불일치가 생기지 않는다).

---

## Task 1: 지도 컴포넌트 컬러 토큰 리스킨 (`components/map/KakaoMap.tsx`)

**Files:**
- Modify: `components/map/KakaoMap.tsx` (전체 255줄 교체)

**Interfaces:**
- Consumes: `WorkSpot` 타입(`@/types`), `cn`(`@/lib/utils`), `MapSpotCard`(Task 2에서 리스킨되는 동일 컴포넌트, props `spot: WorkSpot`/`onClose: () => void` 변경 없음)
- Produces: 없음 (leaf 컴포넌트, `app/map/page.tsx`에서 `spots` prop만 받음 — 변경 없음)

- [ ] **Step 1: `components/map/KakaoMap.tsx` 전체를 아래 내용으로 교체**

```tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { WorkSpot } from "@/types";
import { cn } from "@/lib/utils";
import MapSpotCard from "./MapSpotCard";

const GANGNEUNG = { lat: 37.7519, lng: 128.8759 };

const CONGESTION_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  default: "#6b7280",
};

interface Filters {
  noise: string;
  wifi: boolean;
  power: boolean;
}

function isVisible(spot: WorkSpot, filters: Filters): boolean {
  if (filters.noise && spot.noise !== filters.noise) return false;
  if (filters.wifi && !spot.wifi.available) return false;
  if (filters.power && spot.power.level !== "충분함" && spot.power.level !== "제한적") return false;
  return true;
}

export default function KakaoMap({ spots }: { spots: WorkSpot[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const overlaysRef = useRef<Array<{ overlay: any; spot: WorkSpot }>>([]);

  const [selectedSpot, setSelectedSpot] = useState<WorkSpot | null>(null);
  const [filters, setFilters] = useState<Filters>({ noise: "", wifi: false, power: false });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const visibleCount = spots.filter((s) => isVisible(s, filters)).length;

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;
    let timeoutTimer: ReturnType<typeof setTimeout>;

    function initMap() {
      if (!mapRef.current) {
        setErrorMsg("지도 컨테이너를 찾을 수 없습니다");
        setStatus("error");
        return;
      }
      try {
        const center = new window.kakao.maps.LatLng(GANGNEUNG.lat, GANGNEUNG.lng);
        const map = new window.kakao.maps.Map(mapRef.current, { center, level: 7 });
        mapObj.current = map;

        spots.forEach((spot) => {
          const pos = new window.kakao.maps.LatLng(spot.lat, spot.lng);
          const color = CONGESTION_COLOR[spot.congestion ?? "default"];

          const el = document.createElement("div");
          el.style.cssText = `background:${color};color:#fff;padding:5px 10px;border-radius:9999px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:2px solid #fff;user-select:none;`;
          el.textContent = spot.name;
          el.addEventListener("click", () => {
            setSelectedSpot(spot);
            mapObj.current?.panTo(pos);
          });

          const overlay = new window.kakao.maps.CustomOverlay({
            map,
            position: pos,
            content: el,
            yAnchor: 1.4,
            zIndex: 3,
          });

          overlaysRef.current.push({ overlay, spot });
        });

        clearTimeout(timeoutTimer);
        setStatus("ready");
      } catch (e) {
        setErrorMsg(String(e));
        setStatus("error");
      }
    }

    function startPolling() {
      pollTimer = setInterval(() => {
        if (!window.kakao?.maps) return;
        clearInterval(pollTimer);
        window.kakao.maps.load(initMap);
      }, 100);

      // 10초 안에 로드 안 되면 에러 표시
      timeoutTimer = setTimeout(() => {
        clearInterval(pollTimer);
        setErrorMsg("카카오맵 로드 타임아웃 — API 키와 도메인 설정을 확인해주세요");
        setStatus("error");
      }, 10000);
    }

    // 이미 로드된 경우
    if (window.kakao?.maps) {
      window.kakao.maps.load(initMap);
      return;
    }

    // 스크립트 중복 삽입 방지
    if (document.querySelector('script[src*="dapi.kakao.com"]')) {
      startPolling();
      return;
    }

    // 스크립트 직접 주입
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`;
    script.onerror = () => {
      clearTimeout(timeoutTimer);
      setErrorMsg(`스크립트 로드 실패 — 요청 URL: ${script.src}`);
      setStatus("error");
    };
    script.onload = startPolling;
    document.head.appendChild(script);

    return () => {
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필터 변경 시 오버레이 표시/숨김
  useEffect(() => {
    if (status !== "ready") return;
    overlaysRef.current.forEach(({ overlay, spot }) => {
      overlay.setMap(isVisible(spot, filters) ? mapObj.current : null);
    });
  }, [filters, status]);

  const toggleFilter = (key: keyof Filters, value?: string) => {
    setFilters((prev) => {
      if (key === "noise") return { ...prev, noise: prev.noise === value ? "" : (value ?? "") };
      return { ...prev, [key]: !prev[key as "wifi" | "power"] };
    });
    setSelectedSpot(null);
  };

  return (
    <div className="relative w-full h-full">
      {/* 지도 컨테이너 */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* 로딩 오버레이 */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-20">
          <p className="text-foreground/60 text-sm">지도 불러오는 중...</p>
        </div>
      )}

      {/* 에러 오버레이 */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-bad/10 z-20">
          <div className="text-center p-6 bg-background rounded-2xl shadow border border-bad/30">
            <p className="font-bold text-bad mb-2">지도 로딩 실패</p>
            <p className="text-sm text-bad mb-4">{errorMsg || "알 수 없는 오류"}</p>
            <p className="text-xs text-foreground/60">
              카카오맵 API 키와 도메인 등록을 확인해주세요<br />
              (developers.kakao.com → 앱 → 플랫폼 → Web)
            </p>
          </div>
        </div>
      )}

      {/* 필터 패널 */}
      {status === "ready" && (
        <div className="absolute top-4 left-4 z-10 bg-background rounded-2xl shadow-lg border border-border p-3 space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">필터</span>
            <span className="text-xs text-foreground/60">{visibleCount}곳</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-foreground/60">소음도</p>
            <div className="flex gap-1">
              {[
                { value: "언급됨-조용함", label: "조용 언급" },
                { value: "언급됨-시끄러움", label: "시끄 언급" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleFilter("noise", opt.value)}
                  className={cn(
                    "flex-1 py-1 text-xs rounded-lg border transition-colors",
                    filters.noise === opt.value
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-background text-foreground/70 border-border hover:border-foreground/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => toggleFilter("wifi")}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors",
                filters.wifi
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-background text-foreground/70 border-border hover:border-foreground/40"
              )}
            >
              WiFi
            </button>
            <button
              onClick={() => toggleFilter("power")}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors",
                filters.power
                  ? "bg-accent text-on-accent border-accent"
                  : "bg-background text-foreground/70 border-border hover:border-foreground/40"
              )}
            >
              콘센트
            </button>
          </div>

          <div className="border-t border-border pt-2 space-y-1">
            <p className="text-xs text-foreground/60">혼잡도</p>
            {[
              { color: "bg-green-400", label: "여유" },
              { color: "bg-yellow-400", label: "보통" },
              { color: "bg-red-400", label: "혼잡" },
              { color: "bg-gray-400", label: "정보없음" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", item.color)} />
                <span className="text-xs text-foreground/70">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 선택된 장소 카드 */}
      {selectedSpot && (
        <MapSpotCard spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint components/map/KakaoMap.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 하드코딩 색상 잔존 확인**

Run: `grep -nE "gray-[0-9]|blue-[0-9]|purple-[0-9]|red-50|red-100|bg-white" components/map/KakaoMap.tsx`
Expected: 혼잡도 범례의 `bg-green-400`/`bg-yellow-400`/`bg-red-400`/`bg-gray-400` 4줄만 걸림(의도적 예외) — 그 외 매치는 없어야 함

- [ ] **Step 4: Commit**

```bash
git add components/map/KakaoMap.tsx
git commit -m "feat: KakaoMap 컬러 토큰 리스킨, 다크모드 지원"
```

---

## Task 2: 스팟 카드 리스킨 + 중복 제거 (`components/map/MapSpotCard.tsx`)

**Files:**
- Modify: `components/map/MapSpotCard.tsx` (전체 95줄 교체)

**Interfaces:**
- Consumes: `WorkSpot` 타입(`@/types`), `cn`/`noiseLabel`/`congestionLabel`/`powerLabel`(`@/lib/utils`), `categoryLabel`/`noiseBadge`/`powerBadge`(`@/lib/spot-visuals`, Task 1과 무관하게 이미 존재하는 헬퍼)
- Produces: 없음 (leaf 컴포넌트, props `spot: WorkSpot`/`onClose: () => void` 변경 없음 — Task 1의 `KakaoMap.tsx`가 그대로 사용)

- [ ] **Step 1: `components/map/MapSpotCard.tsx` 전체를 아래 내용으로 교체**

```tsx
import Link from "next/link";
import { WorkSpot } from "@/types";
import { cn, noiseLabel, congestionLabel, powerLabel } from "@/lib/utils";
import { categoryLabel, noiseBadge, powerBadge } from "@/lib/spot-visuals";

// 혼잡도 dot은 지도 마커·필터 패널 범례(KakaoMap.tsx의 CONGESTION_COLOR)와 같은 고정 hex
// 계열이어야 한다 — 마커가 카카오맵 캔버스 내부에 고정 hex로 렌더되므로, 여기서
// lib/spot-visuals.ts의 congestionStyle(good/warn/bad 토큰)을 쓰면 다크모드에서 방금 클릭한
// 마커 색과 이 dot 색이 어긋난다.
const congestionDot: Record<"low" | "medium" | "high", string> = {
  low: "bg-green-400",
  medium: "bg-yellow-400",
  high: "bg-red-400",
};

export default function MapSpotCard({
  spot,
  onClose,
}: {
  spot: WorkSpot;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-background rounded-2xl shadow-xl border border-border z-10 overflow-hidden">
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-foreground/60 font-medium">{categoryLabel[spot.category]}</span>
            {spot.congestion && (
              <span className="flex items-center gap-1 text-xs text-foreground/70">
                <span className={cn("w-1.5 h-1.5 rounded-full", congestionDot[spot.congestion])} />
                예상 {congestionLabel(spot.congestion)}
              </span>
            )}
          </div>
          <h3 className="font-bold text-foreground text-base">{spot.name}</h3>
          <p className="text-xs text-foreground/60 mt-0.5">{spot.address}</p>
        </div>
        <button
          onClick={onClose}
          className="text-foreground/50 hover:text-foreground transition-colors ml-2 mt-0.5"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", spot.noise !== "언급없음" ? noiseBadge[spot.noise] : "bg-muted text-foreground/50")}>
          {noiseLabel(spot.noise)}
        </span>
        {spot.wifi.available === true && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
            WiFi
          </span>
        )}
        {(spot.power.level === "충분함" || spot.power.level === "제한적") && (
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", powerBadge[spot.power.level])}>
            {powerLabel(spot.power.level)}
          </span>
        )}
        <span className="text-xs text-foreground/60">{spot.openHours}</span>
      </div>

      <div className="grid grid-cols-2 border-t border-border">
        <button
          onClick={onClose}
          className="py-3 text-sm text-foreground/70 hover:bg-muted transition-colors"
        >
          닫기
        </button>
        <Link
          href={`/spots/${spot.id}`}
          className="py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors text-center border-l border-border"
        >
          자세히 보기
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint components/map/MapSpotCard.tsx`
Expected: 둘 다 에러 0건

- [ ] **Step 3: 하드코딩 색상 잔존 확인**

Run: `grep -nE "gray-[0-9]|blue-[0-9]|purple-[0-9]|green-100|red-100|amber-[0-9]|bg-white" components/map/MapSpotCard.tsx`
Expected: 결과 없음 (exit code 1) — `congestionDot`의 `green-400`/`yellow-400`/`red-400`은 이 grep 패턴에 안 걸림(의도적 예외, 100단위만 검사)

- [ ] **Step 4: 로컬 중복 정의 제거 확인**

Run: `grep -nE "^const (categoryLabel|noiseBadge|powerBadge):" components/map/MapSpotCard.tsx`
Expected: 결과 없음 (exit code 1) — `congestionDot`만 로컬에 남아있어야 함

- [ ] **Step 5: Commit**

```bash
git add components/map/MapSpotCard.tsx
git commit -m "feat: MapSpotCard 컬러 토큰 리스킨, spot-visuals.ts 재사용으로 중복 제거"
```

---

## Task 3: 최종 검증

**Files:** 없음 (검증 전용)

**Interfaces:** 없음

- [ ] **Step 1: 전체 타입체크 + lint**

Run: `npx tsc --noEmit && npx eslint components/map/KakaoMap.tsx components/map/MapSpotCard.tsx`
Expected: 전부 에러 0건

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공, 관련 파일 에러 0건

- [ ] **Step 3: 신규 조합 대비 확인**

이 라운드가 새로 도입한 배지 색 조합: `bg-primary/15 text-primary`(WiFi 배지, `bg-background` 위) — 스팟/AI큐레이터 라운드에서 `bg-{token}/15` on `bg-background` 패턴이 이미 AA 검증됐고 `WorkEnvScore.tsx`에서 `bg-primary/10 text-primary` 유사 조합이 실사용 중이라 재계산 불필요. `bg-bad/10`(에러 오버레이)은 `bg-background` 위 전제가 없는 신규 케이스이므로 라이트/다크 각각 육안으로 텍스트(`text-bad`) 가독성 확인한다.

- [ ] **Step 4: 필터/카드 인터랙션 회귀 확인 (로컬 브라우저, 가능한 경우)**

`next dev` 상태에서 `/map`을 열어: 마커 클릭 → `MapSpotCard` 표시(WiFi 있음/없음, 콘센트 충분함/제한적/없음 각 케이스 확인 가능한 스팟으로), 카드 닫기, "자세히 보기" 이동, 필터 패널의 소음/WiFi/콘센트 토글 ON·OFF 시 마커 표시/숨김이 정상 동작하는지 확인. 브라우저 도구가 없는 환경이면 이 스텝은 "코드 레벨 확인만, 브라우저 실행 재현 아님"으로 명시하고 건너뛴다.

- [ ] **Step 5: 다크모드 토글 실측 + 마커-dot 색 일치 확인 (로컬 브라우저, 가능한 경우)**

다크 토글 전환 후 필터 패널·로딩/에러 오버레이·`MapSpotCard`가 자연스럽게 전환되는지 확인. 추가로 혼잡도가 다른 마커 2~3개를 각각 클릭해 마커 색(캔버스)과 `MapSpotCard`의 혼잡도 dot 색이 라이트/다크 모드 둘 다에서 일치하는지 육안 확인(Task 2 Global Constraints 보정 사항 검증). 브라우저 도구가 없으면 생략하고 명시한다.

- [ ] **Step 6: 최종 커밋 (필요 시)**

Step 3~5에서 대비 미달이나 마크업/색 불일치 문제를 발견해 코드를 수정했다면:
```bash
git add components/map/KakaoMap.tsx components/map/MapSpotCard.tsx
git commit -m "fix: /map 리스킨 대비/렌더 이슈 수정"
```
문제가 없었다면 이 스텝은 생략.
