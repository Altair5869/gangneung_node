"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RouteStop, LifeSpot, isLifeSpot, WorkSpot } from "@/types";
import { SavedPlan, getPlans, savePlan, deletePlan, encodePlan, decodePlan } from "@/lib/planner-storage";
import { cn, congestionLabel, formatEventDate } from "@/lib/utils";
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
      let cancelled = false;
      decodePlan(shareParam).then((decoded) => {
        if (!cancelled) setSharedPlan(decoded);
      });
      return () => {
        cancelled = true;
      };
    } else {
      // localStorage에서 저장된 플랜 목록을 마운트/shareParam 변경 시 동기적으로 읽어오는
      // 코드다. 이 규칙이 겨냥하는 "연쇄 렌더"(React 상태를 읽어 다시 React 상태를 세팅하는
      // 패턴)가 아니라 외부 시스템(localStorage)과 한 번 동기화하는 것이므로 억제한다
      // (2026-08-07, 옵션 K 요구사항 4·5 — 로직 재작성 금지, 억제 주석만 추가).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlans(getPlans());
    }
  }, [shareParam]);

  const handleDelete = (id: string) => {
    if (!window.confirm("이 플랜을 삭제할까요?")) return;
    deletePlan(id);
    setPlans(getPlans());
    if (expandedId === id) setExpandedId(null);
  };

  const handleCopyLink = async (plan: SavedPlan) => {
    const encoded = await encodePlan(plan);
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
      <section className="bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] py-12">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">Planner</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">워케이션 플래너</h1>
          <p className="text-white/70 text-sm">AI 큐레이터에서 저장한 동선을 관리하고 공유하세요.</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-10 w-full flex-1">
        {plans.length > 0 && (
          <p className="text-xs text-foreground/60 mb-4">
            최대 20개까지 저장되며, 초과 시 가장 오래된 항목부터 자동 삭제됩니다.
          </p>
        )}
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
                : "bg-muted text-foreground/70 hover:bg-border"
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
        {life && (spot as LifeSpot).category === "event" && (spot as LifeSpot).eventStartDate && (spot as LifeSpot).eventEndDate && (
          <p className="text-xs text-foreground/60 truncate">
            행사 기간: {formatEventDate((spot as LifeSpot).eventStartDate!)} ~ {formatEventDate((spot as LifeSpot).eventEndDate!)}
          </p>
        )}
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
    const alreadySaved = getPlans().some(
      (p) => JSON.stringify(p.route) === JSON.stringify(plan.route)
    );
    if (!alreadySaved) {
      savePlan(plan.name, plan.route);
    }
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
      <section className="bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] py-12">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">공유된 동선</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{plan.name}</h1>
          <p className="text-white/70 text-sm">{savedDate} · {plan.route.spots.length}개 장소 · {plan.route.totalDuration}시간</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-10 w-full space-y-6">
        <div className="bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] rounded-2xl p-6 text-white shadow-xl">
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
