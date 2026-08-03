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
