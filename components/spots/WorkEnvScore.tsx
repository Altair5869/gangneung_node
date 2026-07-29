import { WorkSpot } from "@/types";
import { cn, powerLabel, wifiLabel } from "@/lib/utils";

function calcScore(spot: WorkSpot): { score: number; label: string } {
  let score = 0;
  if (spot.wifi.available) score += 30;
  if (spot.power.level === "충분함") score += 25;
  else if (spot.power.level === "제한적") score += 10;
  if (spot.noise === "언급됨-조용함") score += 25;
  if (spot.congestion === "low") score += 10;
  else if (spot.congestion === "medium") score += 5;

  const label = score >= 80 ? "최적" : score >= 60 ? "좋음" : score >= 40 ? "보통" : "낮음";
  return { score, label };
}

const CRITERIA = [
  { key: "wifi",       label: "WiFi 가용" },
  { key: "power",      label: "콘센트 (충분함/제한적)" },
  { key: "quiet",      label: "조용함 언급" },
  { key: "uncrowded",  label: "여유로운 혼잡도" },
] as const;

function scoreColor(score: number) {
  if (score >= 80) return { bar: "bg-good",  text: "text-good",  ring: "bg-good/10 border-good/30" };
  if (score >= 60) return { bar: "bg-primary", text: "text-primary", ring: "bg-primary/10 border-primary/30" };
  if (score >= 40) return { bar: "bg-warn",  text: "text-warn",  ring: "bg-warn/10 border-warn/30" };
  return               { bar: "bg-bad",   text: "text-bad",   ring: "bg-bad/10 border-bad/30" };
}

// 체크 항목은 확정 true/false 뿐 아니라 "미확인"(null)도 가질 수 있다 (예: wifi.available).
// null을 false로 뭉개면 "확정된 없음"처럼 보이므로, 배지 아이콘/색을 3단계로 분리한다.
function checkVisual(state: boolean | null) {
  if (state === true) return { badge: "bg-good text-on-good", icon: "✓", text: "text-foreground" };
  if (state === false) return { badge: "bg-bad/15 text-bad", icon: "✗", text: "text-foreground/60" };
  return { badge: "bg-muted text-foreground/60 border border-border", icon: "–", text: "text-foreground/60 italic" };
}

export default function WorkEnvScore({ spot }: { spot: WorkSpot }) {
  const { score, label } = calcScore(spot);
  const { bar, text, ring } = scoreColor(score);

  // wifi만 null(미확인)을 가질 수 있는 tri-state. 나머지는 항상 boolean이지만
  // 레코드 타입은 하나로 통일해 checkVisual이 모든 항목에 동일하게 적용되게 한다.
  const checks: Record<(typeof CRITERIA)[number]["key"], boolean | null> = {
    wifi:      spot.wifi.available,
    power:     spot.power.level === "충분함" || spot.power.level === "제한적",
    quiet:     spot.noise === "언급됨-조용함",
    uncrowded: spot.congestion === "low" || spot.congestion === "medium",
  };

  return (
    <div className="bg-background border border-border rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-bold text-foreground/40 uppercase tracking-widest">작업 환경 점수</h2>

      {/* 점수 */}
      <div className={cn("flex items-center justify-between rounded-xl px-4 py-3 border", ring)}>
        <span className={cn("text-4xl font-bold", text)}>{score}</span>
        <div className="text-right">
          <p className={cn("text-lg font-bold", text)}>{label}</p>
          <p className="text-xs text-foreground/40">/ 90점</p>
        </div>
      </div>

      {/* 점수 바 */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", bar)}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* 체크리스트 */}
      <ul className="space-y-2">
        {CRITERIA.map((c) => {
          const v = checkVisual(checks[c.key]);
          const criterionLabel =
            c.key === "power" ? powerLabel(spot.power.level) :
            c.key === "wifi"  ? wifiLabel(spot.wifi.available) :
            c.label;
          return (
            <li key={c.key} className="flex items-center gap-2.5 text-sm">
              <span className={cn(
                "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold",
                v.badge
              )}>
                {v.icon}
              </span>
              <span className={v.text}>
                {criterionLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
