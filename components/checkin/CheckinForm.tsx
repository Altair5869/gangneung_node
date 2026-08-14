"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { cn } from "@/lib/utils";
import { CheckinProgress, CheckinRecord } from "@/types";

interface CheckinFormProps {
  spotId: string;
  myCheckin: CheckinRecord | null;
}

type GeoState =
  | { kind: "checking" }
  | { kind: "ready"; lat: number; lng: number }
  | { kind: "denied" }
  | { kind: "unsupported" };

type EligibilityState =
  | { kind: "loading" }
  | { kind: "within" }
  | { kind: "outside"; distanceM: number }
  | { kind: "error" };

const POWER_OPTIONS = ["충분함", "제한적", "없음"] as const;
type PowerLevel = (typeof POWER_OPTIONS)[number];

// R2: 로그인 사용자가 wifi(있음/없음) + power.level(충분함/제한적/없음) 두 필드만 제출한다.
// 자유 텍스트/speedMbps 입력란은 의도적으로 없음(데이터 규칙 2). 위치는 반경 검증을 위해서만
// 쓰고 그 자체를 값으로 저장하지 않는다.
export default function CheckinForm({ spotId, myCheckin }: CheckinFormProps) {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";

  const [geo, setGeo] = useState<GeoState | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityState | null>(null);
  const [wifiAvailable, setWifiAvailable] = useState<boolean | null>(myCheckin?.wifiAvailable ?? null);
  const [powerLevel, setPowerLevel] = useState<PowerLevel | null>(myCheckin?.powerLevel ?? null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 체크인 챌린지/스탬프 투어 1차(배지 1종 MVP): 체크인 성공 직후에만 조회한다. 별도
  // 마이페이지/배지 갤러리는 스코프 아님(요구사항 문서 "스코프 제외") — 이 폼 안에서만 표시.
  const [progress, setProgress] = useState<CheckinProgress | null>(null);

  // 로그인 상태면 페이지 진입과 동시에 위치 권한을 요청한다 — R2-3: 권한 거부/실패 시 체크인
  // 자체를 차단하므로, 사용자가 폼을 만지기 전에 미리 판정해 버튼을 비활성 상태로 보여준다.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo({ kind: "unsupported" });
      return;
    }
    setGeo({ kind: "checking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ kind: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo({ kind: "denied" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [isAuthenticated]);

  // 좌표를 얻으면 서버(하버사인 계산은 lib/ai.ts의 calculateHaversineDistance 하나만 재사용,
  // /api/checkins/eligibility 라우트)에 반경 판정을 물어 버튼을 미리 활성/비활성화한다.
  // 실제 제출 시점에도 POST /api/checkins가 동일 함수로 다시 검증한다 — 여기 결과는 UI 힌트.
  useEffect(() => {
    if (!geo || geo.kind !== "ready") return;
    let cancelled = false;
    setEligibility({ kind: "loading" });
    fetch(`/api/checkins/eligibility?spotId=${encodeURIComponent(spotId)}&lat=${geo.lat}&lng=${geo.lng}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("실패"))))
      .then((data: { withinRadius: boolean; distanceM: number }) => {
        if (cancelled) return;
        setEligibility(data.withinRadius ? { kind: "within" } : { kind: "outside", distanceM: data.distanceM });
      })
      .catch(() => {
        if (!cancelled) setEligibility({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [geo, spotId]);

  async function handleSubmit() {
    if (geo?.kind !== "ready" || eligibility?.kind !== "within" || wifiAvailable === null || powerLevel === null) return;
    setSubmitState("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotId, wifiAvailable, powerLevel, lat: geo.lat, lng: geo.lng }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? "체크인에 실패했어요");
        setSubmitState("error");
        return;
      }
      setSubmitState("success");
      // 진행률 조회 실패는 체크인 성공 자체를 가리지 않는다 — progress는 null로 남고
      // 아래 성공 화면은 진행률 텍스트 없이 렌더링된다(getUserCheckinProgress의 안전한
      // 기본값 반환 패턴과 동일한 원칙: 부가 정보 실패가 핵심 흐름을 막지 않음).
      fetch("/api/checkins/progress")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("실패"))))
        .then((data: CheckinProgress) => setProgress(data))
        .catch(() => setProgress(null));
    } catch {
      setErrorMessage("네트워크 오류로 체크인에 실패했어요");
      setSubmitState("error");
    }
  }

  if (sessionStatus === "loading") return null;

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => signIn("google")}
        className="w-full text-center bg-muted text-foreground/70 py-3 rounded-2xl text-sm font-semibold hover:bg-border transition-colors"
      >
        로그인하고 체크인하기
      </button>
    );
  }

  if (submitState === "success") {
    return (
      <div className="bg-good/10 border border-good/30 rounded-2xl p-4 text-sm text-good font-medium text-center space-y-2">
        <p>체크인이 반영됐어요. 감사합니다!</p>
        {progress && progress.earned && (
          <p className="text-xs font-bold">
            배지 획득! 서로 다른 스팟 {progress.threshold}곳 체크인을 완료했어요 🎉
          </p>
        )}
        {progress && !progress.earned && (
          <p className="text-xs text-good/80">
            {progress.distinctSpotCount}/{progress.threshold}곳 체크인 · 앞으로{" "}
            {progress.threshold - progress.distinctSpotCount}곳 더!
          </p>
        )}
      </div>
    );
  }

  const disabledReason =
    geo?.kind === "checking" || eligibility?.kind === "loading"
      ? "위치 확인 중..."
      : geo?.kind === "denied"
      ? "위치 권한이 필요해요. 브라우저 설정에서 위치 접근을 허용해주세요."
      : geo?.kind === "unsupported"
      ? "이 브라우저는 위치 확인을 지원하지 않아요."
      : eligibility?.kind === "outside"
      ? `스팟 근처(100m 이내)에서만 체크인할 수 있어요. (현재 약 ${eligibility.distanceM}m)`
      : eligibility?.kind === "error"
      ? "위치 확인에 실패했어요. 잠시 후 다시 시도해주세요."
      : null;

  const canSubmit = eligibility?.kind === "within" && wifiAvailable !== null && powerLevel !== null;

  return (
    <div className="bg-background border border-dashed border-border rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-foreground">체크인하기</h3>
      {myCheckin && (
        <p className="text-xs text-foreground/50">
          내 최근 체크인: WiFi {myCheckin.wifiAvailable ? "있음" : "없음"} · 콘센트 {myCheckin.powerLevel}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs text-foreground/60">WiFi</p>
        <div className="flex gap-2">
          {[
            { label: "있음", value: true },
            { label: "없음", value: false },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setWifiAvailable(opt.value)}
              className={cn(
                "flex-1 text-xs font-semibold py-2 rounded-xl border transition-colors",
                wifiAvailable === opt.value
                  ? "bg-primary text-white border-primary"
                  : "border-border text-foreground/60 hover:border-foreground/40"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-foreground/60">콘센트</p>
        <div className="flex gap-2">
          {POWER_OPTIONS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setPowerLevel(level)}
              className={cn(
                "flex-1 text-xs font-semibold py-2 rounded-xl border transition-colors",
                powerLevel === level
                  ? "bg-primary text-white border-primary"
                  : "border-border text-foreground/60 hover:border-foreground/40"
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {disabledReason && <p className="text-xs text-foreground/50">{disabledReason}</p>}
      {submitState === "error" && errorMessage && <p className="text-xs text-bad">{errorMessage}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || submitState === "submitting"}
        className="w-full text-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] text-white py-3 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitState === "submitting" ? "제출 중..." : "체크인 제출"}
      </button>
    </div>
  );
}
