import Link from "next/link";
import { WorkSpot } from "@/types";
import { cn, noiseLabel, congestionLabel } from "@/lib/utils";

const categoryLabel: Record<WorkSpot["category"], string> = {
  cafe: "카페",
  coworking: "코워킹",
  library: "도서관",
  hotel: "호텔",
  other: "기타",
};

const categoryGradient: Record<WorkSpot["category"], string> = {
  cafe: "from-amber-400 to-orange-400",
  coworking: "from-blue-500 to-indigo-500",
  library: "from-emerald-400 to-teal-500",
  hotel: "from-sky-400 to-blue-500",
  other: "from-gray-400 to-slate-500",
};

const noiseBadge: Record<WorkSpot["noise"], string> = {
  quiet: "bg-green-100 text-green-700",
  moderate: "bg-yellow-100 text-yellow-700",
  noisy: "bg-red-100 text-red-700",
};

const congestionStyle: Record<"low" | "medium" | "high", { dot: string; text: string }> = {
  low: { dot: "bg-green-400", text: "text-green-600" },
  medium: { dot: "bg-yellow-400", text: "text-yellow-600" },
  high: { dot: "bg-red-400", text: "text-red-600" },
};

export default function SpotCard({ spot }: { spot: WorkSpot }) {
  return (
    <Link href={`/spots/${spot.id}`} className="group block">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200">

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
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full text-gray-700 shadow-sm">
            {categoryLabel[spot.category]}
          </span>

          {/* 혼잡도 배지 */}
          {spot.congestion && (
            <span className={cn(
              "absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm",
              congestionStyle[spot.congestion].text
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", congestionStyle[spot.congestion].dot)} />
              {congestionLabel(spot.congestion)}
            </span>
          )}
        </div>

        {/* 정보 영역 */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-bold text-gray-900 group-hover:text-sky-600 transition-colors leading-snug">
              {spot.name}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{spot.address}</p>
          </div>

          {/* 편의시설 뱃지 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", noiseBadge[spot.noise])}>
              {noiseLabel(spot.noise)}
            </span>
            {spot.wifi.available && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">
                WiFi
              </span>
            )}
            {spot.power.available && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                콘센트
              </span>
            )}
            {spot.barrierFree !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
                무장애
              </span>
            )}
          </div>

          {/* 영업시간 + 태그 */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-50">
            <span className="text-xs text-gray-400">{spot.openHours}</span>
            <div className="flex gap-1">
              {spot.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
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
