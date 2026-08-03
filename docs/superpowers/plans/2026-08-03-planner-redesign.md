# /planner 페이지 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/planner` 페이지(`app/planner/page.tsx`)를 홈페이지·스팟·AI 큐레이터·`/map` 라운드에서 만든 컬러 토큰 체계로 리스킨하고 다크모드를 지원한다. 이 라운드로 프로젝트의 색상 토큰 리스킨이 완결된다(마지막 미리스킨 페이지).

**Architecture:** 신규 토큰 없음 — 기존 `app/globals.css`의 `primary`/`primary-dark`/`accent`/`background`/`foreground`/`muted`/`border`/`good`/`bad`/`on-primary`/`on-accent` 토큰을 재사용한다. `lib/spot-visuals.ts`의 `categoryLabel` 타입을 `WorkSpot["category"] | LifeSpot["category"]`로 확장해 `/planner`가 소비하는 LifeSpot 카테고리(`attraction`/`stay`/`food`)까지 커버하고, `app/planner/page.tsx`의 로컬 중복 정의를 제거한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. 신규 의존성 없음.

## Global Constraints

- 이번 라운드는 `lib/spot-visuals.ts`, `app/planner/page.tsx`만 대상이다 — `/food`, `/stay`, `/events`, `components/spots/SpotFilter.tsx`는 범위 밖(후속 라운드).
- 프로젝트에 테스트 프레임워크가 없다 — 각 태스크의 검증은 `npx tsc --noEmit`, `npx eslint`, `next dev` 로컬 실행 후 `curl`/육안 확인으로 대체한다.
- 저장/삭제/공유링크복사/공유본저장 동작, `Suspense` 경계 구조(`page.tsx:16-22`)는 절대 변경하지 않는다 — 이번 라운드는 순수 시각적 리스킨이다. `Suspense` 경계를 건드리면 `10d8c57`에서 고친 백지화면 증상이 재발할 수 있다.
- 본문 보조 텍스트는 `text-foreground/60` 이상을 쓴다 — `/40`, `/50`은 라이트모드에서 WCAG AA(4.5:1) 미달로 반복 확인됐다(`d60ba07`, `/map` 라운드).
- 순번 배지(`SpotRow`)의 시맨틱 매핑은 WorkSpot=`primary`, LifeSpot=`accent` — `app/ai-curator/page.tsx`의 결과목록 순번원과 동일한 매핑을 재사용한다.
- `categoryLabel`의 `attraction`/`stay`/`food` 3개 키는 기존 `app/planner/page.tsx` 로컬 정의와 값이 완전히 동일해야 한다(`관광지`/`숙박`/`음식점`) — 렌더 결과가 리스킨 전후로 바뀌면 안 된다.
- `app/ai-curator/page.tsx`의 자체 `lifeCategoryLabel`(`food: "식당"`)은 건드리지 않는다 — 플래너의 `"음식점"`과 다른 기존 불일치지만 이번 스코프 밖이다.
- **계획 작성 중 발견한 기존(리스킨과 무관한) eslint 에러 1건**: `app/planner/page.tsx`의 `shareParam` 처리 `useEffect` 안에서 `setSharedPlan(decoded)`를 동기 호출하는 부분이 `react-hooks/set-state-in-effect` 규칙에 걸려 이미(리스킨 전부터) `error` 1건을 내고 있다(`npx eslint --print-config`로 이 규칙이 `warn`이 아니라 `error`(2)임을 확인함). 이 로직은 이번 태스크에서 손대지 않으므로(순수 색상 리스킨) 이 에러는 리스킨 후에도 그대로 남는다 — Task 2/Task 3의 eslint 기대치는 "에러 0건"이 아니라 "이 사전 존재 에러 1건 외 추가 에러 없음"이다. 수정은 이번 스코프 밖(별도 티켓).

---

## Task 1: `lib/spot-visuals.ts`의 `categoryLabel` 타입 확장

**Files:**
- Modify: `lib/spot-visuals.ts` (전체 34줄 교체)

**Interfaces:**
- Consumes: 없음
- Produces: `categoryLabel: Record<WorkSpot["category"] | LifeSpot["category"], string>` — Task 2가 이 확장된 타입과 8개 키(`cafe`/`coworking`/`library`/`hotel`/`other`/`attraction`/`stay`/`food`)를 가정하고 import한다. `categoryGradient`/`noiseBadge`/`powerBadge`/`congestionStyle`는 이 태스크에서 값 변경 없음 — 기존 소비처(`components/spots/SpotCard.tsx`, `app/ai-curator/page.tsx`, `components/map/MapSpotCard.tsx`)가 계속 동일하게 동작해야 한다.

- [ ] **Step 1: `lib/spot-visuals.ts` 전체를 아래 내용으로 교체**

```ts
import { WorkSpot, LifeSpot } from "@/types";

export const categoryLabel: Record<WorkSpot["category"] | LifeSpot["category"], string> = {
  cafe: "카페",
  coworking: "코워킹",
  library: "도서관",
  hotel: "호텔",
  other: "기타",
  attraction: "관광지",
  stay: "숙박",
  food: "음식점",
};

export const categoryGradient: Record<WorkSpot["category"], string> = {
  cafe: "from-accent to-accent/70",
  coworking: "from-primary to-primary/70",
  library: "from-primary-dark to-primary",
  hotel: "from-hero-glow to-primary/60",
  other: "from-border to-muted",
};

export const noiseBadge: Record<"언급됨-조용함" | "언급됨-시끄러움", string> = {
  "언급됨-조용함": "bg-good/15 text-good",
  "언급됨-시끄러움": "bg-bad/15 text-bad",
};

export const powerBadge: Record<"충분함" | "제한적" | "없음", string> = {
  "충분함": "bg-good/15 text-good",
  "제한적": "bg-warn/15 text-warn",
  "없음": "bg-bad/15 text-bad",
};

export const congestionStyle: Record<"low" | "medium" | "high", { dot: string; text: string }> = {
  low: { dot: "bg-good", text: "text-good" },
  medium: { dot: "bg-warn", text: "text-warn" },
  high: { dot: "bg-bad", text: "text-bad" },
};
```

- [ ] **Step 2: 타입체크 + eslint (이 파일 + 기존 소비처 전부)**

Run: `npx tsc --noEmit && npx eslint lib/spot-visuals.ts components/spots/SpotCard.tsx app/ai-curator/page.tsx components/map/MapSpotCard.tsx`
Expected: 전부 에러 0건 — 타입 확장이 기존 소비처를 깨지 않았는지 확인

- [ ] **Step 3: Commit**

```bash
git add lib/spot-visuals.ts
git commit -m "feat: categoryLabel 타입에 LifeSpot 카테고리(관광지/숙박/음식점) 추가"
```

---

## Task 2: `/planner` 페이지 리스킨 + 중복 제거 (`app/planner/page.tsx`)

**Files:**
- Modify: `app/planner/page.tsx` (전체 302줄 교체)

**Interfaces:**
- Consumes: Task 1의 `categoryLabel`(`@/lib/spot-visuals`, `Record<WorkSpot["category"] | LifeSpot["category"], string>`). `RouteStop`/`isLifeSpot`/`WorkSpot`(`@/types`), `SavedPlan`/`getPlans`/`savePlan`/`deletePlan`/`encodePlan`/`decodePlan`(`@/lib/planner-storage`, 시그니처 무변경), `cn`/`congestionLabel`(`@/lib/utils`) — 전부 기존 그대로.
- Produces: 없음 (leaf 페이지)

- [ ] **Step 1: `app/planner/page.tsx` 전체를 아래 내용으로 교체**

```tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RouteStop, isLifeSpot, WorkSpot } from "@/types";
import { SavedPlan, getPlans, savePlan, deletePlan, encodePlan, decodePlan } from "@/lib/planner-storage";
import { cn, congestionLabel } from "@/lib/utils";
import { categoryLabel } from "@/lib/spot-visuals";

export default function PlannerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-foreground/60 text-sm">불러오는 중...</div>}>
      <PlannerContent />
    </Suspense>
  );
}

function PlannerContent() {
  const searchParams = useSearchParams();
  const shareParam = searchParams.get("share");

  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [sharedPlan, setSharedPlan] = useState<SavedPlan | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (shareParam) {
      const decoded = decodePlan(shareParam);
      setSharedPlan(decoded);
    } else {
      setPlans(getPlans());
    }
  }, [shareParam]);

  const handleDelete = (id: string) => {
    deletePlan(id);
    setPlans(getPlans());
    if (expandedId === id) setExpandedId(null);
  };

  const handleCopyLink = async (plan: SavedPlan) => {
    const encoded = encodePlan(plan);
    const url = `${window.location.origin}/planner?share=${encoded}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(plan.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (shareParam) {
    return <SharedPlanView plan={sharedPlan} />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-primary-dark py-12">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">Planner</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">워케이션 플래너</h1>
          <p className="text-white/70 text-sm">AI 큐레이터에서 저장한 동선을 관리하고 공유하세요.</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-10 w-full flex-1">
        {plans.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-foreground/60 text-lg font-semibold mb-2">저장된 동선이 없습니다</p>
            <p className="text-foreground/60 text-sm mb-8">AI 큐레이터에서 마음에 드는 동선을 저장해보세요.</p>
            <Link
              href="/ai-curator"
              className="inline-block px-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              AI 동선 만들러 가기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isExpanded={expandedId === plan.id}
                onToggle={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
                onDelete={() => handleDelete(plan.id)}
                onCopyLink={() => handleCopyLink(plan)}
                copied={copiedId === plan.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  plan, isExpanded, onToggle, onDelete, onCopyLink, copied,
}: {
  plan: SavedPlan;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const savedDate = new Date(plan.savedAt).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="bg-background rounded-2xl border border-border overflow-hidden">
      <div
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          // 카드 내부 "공유 링크"/"삭제" 버튼에 포커스가 있을 때 Enter/Space를 누르면 그 버튼
          // 자체의 클릭 동작만 발생해야 한다(버튼 클릭 핸들러가 이미 stopPropagation으로 카드
          // onClick 전파를 막고 있음, :130,141). 이 onKeyDown은 카드 헤더 div에만 달려 있으므로
          // 버튼이 포커스를 가진 상태에서는 키 이벤트가 버튼에서 먼저 처리되고 이 핸들러까지
          // 버블링되지 않는다 — 다만 혹시 모를 재전파를 막기 위해 이벤트 대상이 div 자신일 때만
          // 토글하도록 e.target === e.currentTarget으로도 한 번 더 방어한다.
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground truncate">{plan.name}</h3>
          <p className="text-xs text-foreground/60 mt-0.5">
            {savedDate} · {plan.route.spots.length}개 장소 · {plan.route.totalDuration}시간
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onCopyLink(); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              copied
                ? "bg-good/15 text-good"
                : "bg-muted text-foreground/70 hover:bg-muted/70"
            )}
          >
            {copied ? "복사됨" : "공유 링크"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-bad/15 text-bad hover:bg-bad/25 transition-colors"
          >
            삭제
          </button>
          <span className={cn("text-foreground/60 text-sm transition-transform", isExpanded ? "rotate-180" : "")}>
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border p-5 space-y-4">
          <p className="text-sm text-foreground/70 leading-relaxed">{plan.route.description}</p>
          <div className="space-y-2">
            {plan.route.spots.map((spot, i) => (
              <SpotRow key={spot.id} spot={spot} index={i} />
            ))}
          </div>
          {plan.route.tips.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
              <p className="text-xs font-bold text-primary mb-2">워케이션 팁</p>
              <ul className="space-y-1">
                {plan.route.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-primary">{i + 1}. {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpotRow({ spot, index }: { spot: RouteStop; index: number }) {
  const life = isLifeSpot(spot);
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm",
          life ? "bg-accent text-on-accent" : "bg-primary text-on-primary"
        )}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{spot.name}</p>
        <p className="text-xs text-foreground/60 truncate">{spot.address}</p>
      </div>
      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/60 font-medium">
        {categoryLabel[spot.category] ?? spot.category}
      </span>
      {!life && (spot as WorkSpot).congestion && (
        <span className="flex-shrink-0 text-xs text-foreground/60">
          {congestionLabel((spot as WorkSpot).congestion)}
        </span>
      )}
    </div>
  );
}

function SharedPlanView({ plan }: { plan: SavedPlan | null }) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!plan) return;
    savePlan(plan.name, plan.route);
    setSaved(true);
  };

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground/70 font-semibold mb-4">유효하지 않은 공유 링크입니다.</p>
          <Link href="/planner" className="text-primary text-sm font-semibold hover:underline">
            플래너로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const savedDate = new Date(plan.savedAt).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-primary-dark py-12">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">공유된 동선</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{plan.name}</h1>
          <p className="text-white/70 text-sm">{savedDate} · {plan.route.spots.length}개 장소 · {plan.route.totalDuration}시간</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-10 w-full space-y-6">
        <div className="bg-primary-dark rounded-2xl p-6 text-white">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-3">AI 추천 동선</p>
          <p className="text-sm leading-relaxed">{plan.route.description}</p>
        </div>

        <div className="space-y-2">
          {plan.route.spots.map((spot, i) => (
            <SpotRow key={spot.id} spot={spot} index={i} />
          ))}
        </div>

        {plan.route.tips.length > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5">
            <p className="text-sm font-bold text-primary mb-3">워케이션 팁</p>
            <ul className="space-y-2">
              {plan.route.tips.map((tip, i) => (
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

        <div className="flex gap-3">
          {!saved ? (
            <button
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity"
            >
              내 플래너에 저장
            </button>
          ) : (
            <div className="flex-1 py-3 rounded-xl text-sm font-semibold bg-good/15 text-good text-center">
              저장 완료
            </div>
          )}
          <Link
            href="/planner"
            className="flex-1 py-3 rounded-xl text-sm font-semibold border border-border text-foreground/70 hover:border-foreground/40 transition-colors text-center"
          >
            플래너 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + eslint**

Run: `npx tsc --noEmit && npx eslint app/planner/page.tsx`
Expected: `tsc`는 에러 0건. `eslint`는 `react-hooks/set-state-in-effect` 1건만 나온다(Global Constraints에 명시된 리스킨과 무관한 사전 존재 에러, `shareParam` `useEffect`의 `setSharedPlan(decoded)` 호출) — 그 외 에러가 있으면 실패로 취급한다.

- [ ] **Step 3: 하드코딩 색상 잔존 확인**

Run: `grep -cE '(bg|text|border|from|via|to)-(gray|sky|teal|red|green)-[0-9]{2,3}' app/planner/page.tsx`
Expected: `0`

- [ ] **Step 4: 인라인 hex 제거 확인**

Run: `grep -n "style={{ background" app/planner/page.tsx`
Expected: 결과 없음 (exit code 1)

- [ ] **Step 5: 로컬 `categoryLabel` 중복 제거 확인**

Run: `grep -n "^const categoryLabel" app/planner/page.tsx`
Expected: 결과 없음 (exit code 1)

- [ ] **Step 6: Commit**

```bash
git add app/planner/page.tsx
git commit -m "feat: /planner 페이지 컬러 토큰 리스킨, 다크모드 지원"
```

---

## Task 3: 최종 검증

**Files:** 없음 (검증 전용)

**Interfaces:** 없음

- [ ] **Step 1: 전체 타입체크 + lint**

Run: `npx tsc --noEmit && npx eslint lib/spot-visuals.ts app/planner/page.tsx components/spots/SpotCard.tsx app/ai-curator/page.tsx components/map/MapSpotCard.tsx`
Expected: `tsc` 에러 0건. `eslint`는 `app/planner/page.tsx`의 사전 존재 `react-hooks/set-state-in-effect` 1건(Global Constraints 참고)만 있고, 그 외 파일·규칙에서는 에러 0건.

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공, 관련 파일 에러 0건

- [ ] **Step 3: 신규 조합 대비 확인**

`text-on-accent`(LifeSpot 순번 배지)는 `/map` 라운드에서 이미 육안 확인됐지만 `/planner`에서는 처음 렌더되는 위치이므로 재확인한다. `bg-primary/10 text-primary`(워케이션 팁 박스)는 AI 큐레이터 라운드에서 이미 검증된 패턴 재사용 — 재계산 불필요. 라이트/다크 각각에서 순번 배지(WorkSpot=`primary`, LifeSpot=`accent`) 텍스트 가독성을 육안 확인한다.

- [ ] **Step 4: 기능 회귀 확인 (로컬 브라우저, 가능한 경우)**

`next dev` 상태에서 `/planner`를 열어: 저장된 동선이 없는 빈 상태, `/ai-curator`에서 동선을 저장한 뒤 목록에 나타나는지, 카드 펼치기/접기, "공유 링크" 클릭 후 "복사됨" 표시, 삭제 버튼(항목이 사라지는지), 복사한 링크로 실제 `/planner?share=...` 접속 시 공유뷰가 정상 렌더되는지, "내 플래너에 저장" 클릭 후 "저장 완료" 표시, 유효하지 않은 `?share=` 값으로 접속 시 "유효하지 않은 공유 링크" 화면을 확인한다. 브라우저 도구가 없는 환경이면 "코드 레벨 확인만, 브라우저 실행 재현 아님"으로 명시하고 건너뛴다.

- [ ] **Step 5: `categoryLabel` 통합 회귀 확인**

펼친 카드의 스팟 목록에서 워크스팟(카페/코워킹/도서관/호텔/기타)과 라이프스팟(관광지/숙박/음식점) 카테고리 배지가 모두 한글로 정상 표시되는지 확인한다 — 영문 원문(`attraction` 등)이 노출되면 타입 확장 실수다. 실사용 데이터에 라이프스팟이 없다면 `/ai-curator`에서 라이프스팟이 포함된 동선을 만들어 저장한 뒤 확인한다.

- [ ] **Step 6: 다크모드 토글 실측 (로컬 브라우저, 가능한 경우)**

다크 토글 전환 후 히어로(양쪽 화면 모두)·카드·팁 박스·배지·공유뷰가 자연스럽게 전환되는지 육안 확인. Step 4와 마찬가지로 브라우저 도구가 없으면 생략하고 명시한다.

- [ ] **Step 7: 최종 커밋 (필요 시)**

Step 3~6에서 대비 미달이나 렌더/회귀 문제를 발견해 코드를 수정했다면:
```bash
git add lib/spot-visuals.ts app/planner/page.tsx
git commit -m "fix: /planner 리스킨 대비/렌더 이슈 수정"
```
문제가 없었다면 이 스텝은 생략.
