import { RouteStop, RouteVerification, WorkSpot, CheckStatus, isLifeSpot } from "@/types";
import { cn } from "@/lib/utils";
import { powerBadge } from "@/lib/spot-visuals";

// 미확인(null)·언급없음은 "확정된 없음"이 아니므로 절대 bad(빨강)로 칠하지 않는다.
// 회색 중립 배지로만 표기한다 (CLAUDE.md 데이터 규칙 1·3).
const NEUTRAL_BADGE = "bg-muted text-foreground/60 border border-border";

const CHECK_VISUAL: Record<CheckStatus, { icon: string; badge: string; label: string; row: string }> = {
  pass: { icon: "✓", badge: "bg-good/15 text-good", label: "통과", row: "" },
  fail: { icon: "✗", badge: "bg-bad/15 text-bad", label: "위반", row: "" },
  // skipped를 통과처럼 보이게 하면 "검증한 척"이 되므로 흐리게 낮춘다.
  skipped: { icon: "–", badge: NEUTRAL_BADGE, label: "검사 안 함", row: "opacity-60" },
};

function wifiTone(available: boolean | null | undefined): string {
  if (available === true) return "bg-good/15 text-good";
  if (available === false) return "bg-bad/15 text-bad";
  return NEUTRAL_BADGE;
}

function powerTone(spot?: WorkSpot): string {
  const level = spot?.power.level;
  return level ? powerBadge[level] : NEUTRAL_BADGE;
}

// 소음은 확정 사실이 아니라 신호다(CLAUDE.md 데이터 규칙 3). 무장애(실데이터)·WiFi·콘센트처럼
// 사실 확인이 가능한 항목과 **같은 시각 위계로 보이면 안 되므로**, 채워진 배경(bg-*/15) 대신
// 점선 테두리 + 투명 배경 + 낮은 채도로 낮춘다. 문구는 noiseLabel() 결과("… 언급")를 그대로 쓰고
// 각주로 출처를 밝힌다. lib/spot-visuals.ts의 noiseBadge 원본은 /spots 화면이 공유하므로 건드리지 않는다.
const NOISE_SIGNAL_BASE = "border border-dashed bg-transparent";

function noiseTone(spot?: WorkSpot): string {
  if (!spot || spot.noise === "언급없음") return `${NOISE_SIGNAL_BASE} border-border text-foreground/50`;
  if (spot.noise === "언급됨-시끄러움") return `${NOISE_SIGNAL_BASE} border-bad/40 text-bad/80`;
  return `${NOISE_SIGNAL_BASE} border-good/40 text-good/80`;
}

export default function RouteVerificationCard({
  verification,
  spots,
}: {
  verification: RouteVerification;
  spots: RouteStop[];
}) {
  const workSpotById = new Map(
    spots.filter((s): s is WorkSpot => !isLifeSpot(s)).map((s) => [s.id, s])
  );
  const passCount = verification.checks.filter((c) => c.status === "pass").length;
  const checkedCount = verification.checks.filter((c) => c.status !== "skipped").length;

  return (
    <div className="bg-background border border-border rounded-2xl p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">AI 추천 검증 결과</h2>
          <p className="text-xs text-foreground/50 mt-1">
            AI가 고른 동선을 코드로 다시 검사한 결과입니다 (AI에게 되묻지 않습니다).
          </p>
        </div>
        <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
          {passCount}/{checkedCount} 통과
        </span>
      </div>

      {/* 검증 항목 */}
      <ul className="space-y-2">
        {verification.checks.map((check) => {
          const visual = CHECK_VISUAL[check.status];
          return (
            <li
              key={check.id}
              className={cn("flex items-start gap-3 rounded-xl border border-border px-3 py-2.5", visual.row)}
            >
              <span
                className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                  visual.badge
                )}
              >
                {visual.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{check.label}</p>
                {check.detail && <p className="text-xs text-foreground/50 mt-0.5">{check.detail}</p>}
              </div>
              <span className="flex-shrink-0 text-[11px] text-foreground/40 font-medium mt-0.5">
                {visual.label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* 생성 시도 횟수 */}
      <div className="flex items-center justify-between text-xs text-foreground/60 border-t border-border pt-3">
        <span>AI 생성 시도</span>
        <span className="font-semibold text-foreground/80">
          {verification.attempts}회
          {verification.attempts > 1 && " (검증 불합격으로 재생성)"}
        </span>
      </div>

      {/* 워크스팟 데이터 상태 */}
      {verification.evidence.length > 0 && (
        <div className="border-t border-border pt-4 space-y-3">
          <h3 className="text-xs font-bold text-foreground/40 uppercase tracking-widest">
            워크스팟 데이터 상태
          </h3>
          {verification.evidence.map((ev) => {
            const spot = workSpotById.get(ev.spotId);
            return (
              <div key={ev.spotId} className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{spot?.name ?? ev.spotId}</p>
                  <span
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full font-medium",
                      ev.measured ? "bg-primary/10 text-primary" : NEUTRAL_BADGE
                    )}
                  >
                    {ev.measured ? "실측 확인" : "API 제공"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", wifiTone(spot?.wifi.available))}>
                    {ev.wifi}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", powerTone(spot))}>
                    {ev.power}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", noiseTone(spot))}>
                    {ev.noise}
                  </span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      ev.barrierFree === "출입 가능 확인" ? "bg-good/15 text-good" : NEUTRAL_BADGE
                    )}
                  >
                    무장애 {ev.barrierFree}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-foreground/40 border-t border-border pt-3">
        · &quot;미확인&quot;은 정보가 확인되지 않았다는 뜻이며 &quot;없음&quot;과 다릅니다.<br />
        · 소음은 블로그·검색 스니펫에서 언급이 있었는지를 나타내는 신호로, 시간대·요일에 따라 달라질 수 있습니다.<br />
        · 이동 거리는 좌표 기반 직선(하버사인) 합계이며 실제 도로 경로와 다릅니다.
      </p>
    </div>
  );
}
