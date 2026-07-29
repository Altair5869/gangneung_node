import Link from "next/link";
import { WorkSpot } from "@/types";
import { cn, noiseLabel, congestionLabel, powerLabel, isBarrierFree } from "@/lib/utils";
import { categoryLabel, categoryGradient, noiseBadge, powerBadge, congestionStyle } from "@/lib/spot-visuals";

export default function SpotCard({ spot }: { spot: WorkSpot }) {
  return (
    <Link href={`/spots/${spot.id}`} className="group block">
      <div className="bg-background rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200">

        {/* 이미지 / 카테고리 배경 */}
        <div className="h-44 relative overflow-hidden">
          {spot.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={spot.imageUrl}
              alt={spot.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center", categoryGradient[spot.category])}>
              <span className="text-white text-2xl font-bold opacity-30 select-none">
                {categoryLabel[spot.category]}
              </span>
            </div>
          )}

          {/* 카테고리 배지 */}
          <span className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full text-foreground shadow-sm">
            {categoryLabel[spot.category]}
          </span>

          {/* 혼잡도 배지 */}
          {spot.congestion && (
            <span className={cn(
              "absolute top-3 right-3 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm",
              congestionStyle[spot.congestion].text
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", congestionStyle[spot.congestion].dot)} />
              예상 {congestionLabel(spot.congestion)}
            </span>
          )}
        </div>

        {/* 정보 영역 */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
              {spot.name}
            </h3>
            <p className="text-xs text-foreground/60 mt-0.5 truncate">{spot.address}</p>
          </div>

          {/* 편의시설 뱃지 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", spot.noise !== "언급없음" ? noiseBadge[spot.noise] : "bg-muted text-foreground/60")}>
              {noiseLabel(spot.noise)}
            </span>
            {spot.wifi.available === true && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-good/15 text-good font-medium">
                WiFi
              </span>
            )}
            {spot.wifi.available === null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/60 font-medium">
                WiFi 미확인
              </span>
            )}
            {spot.power.level !== null && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", powerBadge[spot.power.level])}>
                {powerLabel(spot.power.level)}
              </span>
            )}
            {spot.power.level === null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/60 font-medium">
                콘센트 미확인
              </span>
            )}
            {isBarrierFree(spot.barrierFree) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-good/15 text-good font-medium">
                무장애
              </span>
            )}
          </div>

          {/* 영업시간 + 태그 */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs text-foreground/60">{spot.openHours}</span>
            <div className="flex gap-1">
              {spot.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-xs text-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
