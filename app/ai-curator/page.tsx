"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WorkSpot, LifeSpot, CurationRoute, isLifeSpot } from "@/types";
import { cn, congestionLabel, isBarrierFree } from "@/lib/utils";
import { categoryLabel, congestionStyle } from "@/lib/spot-visuals";
import RouteMap from "@/components/map/RouteMap";
import RouteVerificationCard from "@/components/curator/RouteVerificationCard";
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

// 클라이언트 타이머 기반 로딩 단계 문구 (옵션 G6, 2026-08-07).
// 서버 상태를 실시간 반영하는 게 아니라 실측 응답 시간(route.ts 주석: 12.4~13.6초)에
// 맞춘 "예상 진행 상황" 추정 표시일 뿐이다 — 퍼센트 바나 "검증 3/3 통과" 같은 확정 문구는
// 만들지 않는다. 8초 이후에는 실측 범위를 넘겨도(재시도 등) 무한 로딩처럼 보이지 않도록
// 마지막 단계 문구에 계속 머문다.
const LOADING_STAGES: { delayMs: number; text: string }[] = [
  { delayMs: 0, text: "선호 조건에 맞는 후보를 찾는 중..." },
  { delayMs: 2000, text: "AI가 동선을 구성하는 중..." },
  { delayMs: 4000, text: "이동 거리·조건을 검증하는 중..." },
  { delayMs: 8000, text: "조건에 맞는 곳을 찾고 있어요, 잠시만요..." },
];

export default function AiCuratorPage() {
  const [workStyle, setWorkStyle] = useState(WORK_STYLES[0].value);
  const [duration, setDuration] = useState(4);
  const [startHour, setStartHour] = useState<number | undefined>(undefined);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(LOADING_STAGES[0].text);
  const loadingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
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

  // 예약된 로딩 단계 타이머를 전부 취소한다. 응답 완료/에러/컴포넌트 unmount/연속 요청
  // 시작 시 반드시 호출해서, 이전 요청의 타이머가 살아남아 문구가 겹치는 일이 없게 한다.
  const clearLoadingTimers = () => {
    loadingTimersRef.current.forEach(clearTimeout);
    loadingTimersRef.current = [];
  };

  // unmount 시 정리 (React StrictMode 개발 모드에서는 이 effect도 mount→cleanup→mount로
  // 두 번 실행되지만, clearLoadingTimers는 그 시점에 등록된 타이머가 없어도 안전하게
  // no-op으로 끝난다).
  useEffect(() => {
    return () => clearLoadingTimers();
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    // 이전 요청이 남긴 타이머가 있다면 먼저 정리하고 첫 단계 문구로 리셋한 뒤,
    // 두 번째 단계부터 실측 타이밍(LOADING_STAGES)에 맞춰 새로 예약한다.
    clearLoadingTimers();
    setLoadingText(LOADING_STAGES[0].text);
    loadingTimersRef.current = LOADING_STAGES.slice(1).map((stage) =>
      setTimeout(() => setLoadingText(stage.text), stage.delayMs)
    );

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

      // 서버(app/api/ai/curate/route.ts)는 어차피 id만 대조하고 필드는 자체 코퍼스에서 전량
      // 재조회하므로, 전체 객체가 아니라 id 배열만 보낸다(2026-08-07, 옵션 K 요구사항 1).
      let res: Response;
      try {
        res = await fetch("/api/ai/curate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            curationRequest: { workStyle, duration, preferences, freeText: freeText.trim() || undefined, startHour },
            spots: spots.map((s) => s.id),
            lifeSpots: lifeSpots.map((s) => s.id),
          }),
        });
      } catch {
        // fetch 자체가 reject되는 경우(네트워크 끊김, DNS 실패 등) — 서버 응답 자체가 없어
        // res.json()을 시도할 대상이 없으므로 400/500 분기와 별도로 처리한다.
        setError("네트워크 연결을 확인해주세요. 서버에 연결할 수 없습니다.");
        return;
      }

      if (!res.ok) {
        // 서버가 이미 error 코드별로 다른 message를 내려주므로(invalid_json/invalid_spots/
        // invalid_curation_request는 400, curation_failed는 500) body를 읽어 그대로 노출한다
        // (2026-08-07, 옵션 K 요구사항 2 — 이전엔 body를 버리고 고정 문구 1개만 띄웠음).
        let serverMessage: string | undefined;
        try {
          const errBody = (await res.json()) as { error?: string; message?: string };
          serverMessage = errBody?.message;
        } catch {
          // 에러 응답 본문조차 JSON이 아닌 극단적 케이스 — 상태 코드 기반 기본 문구로 폴백.
        }
        if (serverMessage) {
          setError(serverMessage);
        } else if (res.status >= 500) {
          setError("서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        } else {
          setError("요청 형식에 문제가 있습니다. 잠시 후 다시 시도해주세요.");
        }
        return;
      }

      const data = (await res.json()) as { route: CurationRoute };
      setResult(data.route);
      setShowSaveForm(false);
      setSavedPlanId(null);
      setPlanName(`강릉 워케이션 ${new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`);
    } catch {
      setError("AI 큐레이터 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
      clearLoadingTimers();
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

      <div className="flex-1 bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10 w-full">

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
                    <p className={cn("text-xs mt-0.5", workStyle === s.value ? "text-on-primary/80" : "text-foreground/40")}>
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
                    {loadingText}
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
                  <span className="text-sm text-white/80">총 일정</span>
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
                                life ? "bg-accent text-on-accent" : "bg-muted text-foreground/60"
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

              {/* 검증 결과 — verification이 없는 과거 응답/저장 플랜과의 역호환을 위해 optional 렌더 */}
              {result.verification && (
                <RouteVerificationCard verification={result.verification} spots={result.spots} />
              )}

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
