import { WorkSpot } from "@/types";
import { cn } from "@/lib/utils";

function calcScore(spot: WorkSpot): { score: number; label: string } {
  let score = 0;
  if (spot.wifi.available) score += 30;
  if ((spot.wifi.speedMbps ?? 0) >= 100) score += 10;
  if (spot.power.available) score += 25;
  if (spot.noise === "quiet") score += 25;
  else if (spot.noise === "moderate") score += 10;
  if (spot.congestion === "low") score += 10;
  else if (spot.congestion === "medium") score += 5;

  const label = score >= 80 ? "최적" : score >= 60 ? "좋음" : score >= 40 ? "보통" : "낮음";
  return { score, label };
}

const CRITERIA = [
  { key: "wifi",       label: "WiFi 가용" },
  { key: "wifiSpeed",  label: "WiFi 100Mbps 이상" },
  { key: "power",      label: "콘센트" },
  { key: "quiet",      label: "조용한 환경" },
  { key: "uncrowded",  label: "여유로운 혼잡도" },
] as const;

function scoreColor(score: number) {
  if (score >= 80) return { bar: "bg-green-500", text: "text-green-600", ring: "bg-green-50 border-green-200" };
  if (score >= 60) return { bar: "bg-sky-500",   text: "text-sky-600",   ring: "bg-sky-50 border-sky-200" };
  if (score >= 40) return { bar: "bg-yellow-400",text: "text-yellow-600",ring: "bg-yellow-50 border-yellow-200" };
  return               { bar: "bg-red-400",    text: "text-red-500",   ring: "bg-red-50 border-red-200" };
}

export default function WorkEnvScore({ spot }: { spot: WorkSpot }) {
  const { score, label } = calcScore(spot);
  const { bar, text, ring } = scoreColor(score);

  const checks: Record<(typeof CRITERIA)[number]["key"], boolean> = {
    wifi:      spot.wifi.available,
    wifiSpeed: (spot.wifi.speedMbps ?? 0) >= 100,
    power:     spot.power.available,
    quiet:     spot.noise === "quiet",
    uncrowded: spot.congestion === "low" || spot.congestion === "medium",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">작업 환경 점수</h2>

      {/* 점수 */}
      <div className={cn("flex items-center justify-between rounded-xl px-4 py-3 border", ring)}>
        <span className={cn("text-4xl font-bold", text)}>{score}</span>
        <div className="text-right">
          <p className={cn("text-lg font-bold", text)}>{label}</p>
          <p className="text-xs text-gray-400">/ 100점</p>
        </div>
      </div>

      {/* 점수 바 */}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", bar)}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* 체크리스트 */}
      <ul className="space-y-2">
        {CRITERIA.map((c) => (
          <li key={c.key} className="flex items-center gap-2.5 text-sm">
            <span className={cn(
              "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold",
              checks[c.key] ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-300"
            )}>
              {checks[c.key] ? "✓" : "✗"}
            </span>
            <span className={checks[c.key] ? "text-gray-700" : "text-gray-400"}>
              {c.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
