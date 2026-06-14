"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RouteStop, isLifeSpot, WorkSpot } from "@/types";
import { SavedPlan, getPlans, savePlan, deletePlan, encodePlan, decodePlan } from "@/lib/planner-storage";
import { cn, congestionLabel } from "@/lib/utils";

const categoryLabel: Record<string, string> = {
  cafe: "카페", coworking: "코워킹", library: "도서관",
  hotel: "호텔", other: "기타", attraction: "관광지",
  stay: "숙박", food: "음식점",
};

export default function PlannerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">불러오는 중...</div>}>
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
      <section className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase mb-2">Planner</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">워케이션 플래너</h1>
          <p className="text-gray-400 text-sm">AI 큐레이터에서 저장한 동선을 관리하고 공유하세요.</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-10 w-full flex-1">
        {plans.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg font-semibold mb-2">저장된 동선이 없습니다</p>
            <p className="text-gray-400 text-sm mb-8">AI 큐레이터에서 마음에 드는 동선을 저장해보세요.</p>
            <Link
              href="/ai-curator"
              className="inline-block px-6 py-3 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors"
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
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{plan.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {savedDate} · {plan.route.spots.length}개 장소 · {plan.route.totalDuration}시간
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onCopyLink(); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              copied
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {copied ? "복사됨" : "공유 링크"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
          >
            삭제
          </button>
          <span className={cn("text-gray-400 text-sm transition-transform", isExpanded ? "rotate-180" : "")}>
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">{plan.route.description}</p>
          <div className="space-y-2">
            {plan.route.spots.map((spot, i) => (
              <SpotRow key={spot.id} spot={spot} index={i} />
            ))}
          </div>
          {plan.route.tips.length > 0 && (
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
              <p className="text-xs font-bold text-sky-800 mb-2">워케이션 팁</p>
              <ul className="space-y-1">
                {plan.route.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-sky-700">{i + 1}. {tip}</li>
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
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
        style={{ background: life ? "#0d9488" : "#0369a1" }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{spot.name}</p>
        <p className="text-xs text-gray-400 truncate">{spot.address}</p>
      </div>
      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
        {categoryLabel[spot.category] ?? spot.category}
      </span>
      {!life && (spot as WorkSpot).congestion && (
        <span className="flex-shrink-0 text-xs text-gray-400">
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
          <p className="text-gray-500 font-semibold mb-4">유효하지 않은 공유 링크입니다.</p>
          <Link href="/planner" className="text-sky-600 text-sm font-semibold hover:underline">
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
      <section className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase mb-2">공유된 동선</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{plan.name}</h1>
          <p className="text-gray-400 text-sm">{savedDate} · {plan.route.spots.length}개 장소 · {plan.route.totalDuration}시간</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-10 w-full space-y-6">
        <div className="bg-gradient-to-br from-sky-700 to-teal-600 rounded-2xl p-6 text-white">
          <p className="text-xs font-semibold text-sky-300 uppercase tracking-widest mb-3">AI 추천 동선</p>
          <p className="text-sm leading-relaxed">{plan.route.description}</p>
        </div>

        <div className="space-y-2">
          {plan.route.spots.map((spot, i) => (
            <SpotRow key={spot.id} spot={spot} index={i} />
          ))}
        </div>

        {plan.route.tips.length > 0 && (
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5">
            <p className="text-sm font-bold text-sky-800 mb-3">워케이션 팁</p>
            <ul className="space-y-2">
              {plan.route.tips.map((tip, i) => (
                <li key={i} className="flex gap-3 text-sm text-sky-700">
                  <span className="flex-shrink-0 w-5 h-5 bg-sky-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
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
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-sky-700 text-white hover:bg-sky-600 transition-colors"
            >
              내 플래너에 저장
            </button>
          ) : (
            <div className="flex-1 py-3 rounded-xl text-sm font-semibold bg-green-100 text-green-700 text-center">
              저장 완료
            </div>
          )}
          <Link
            href="/planner"
            className="flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors text-center"
          >
            플래너 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
