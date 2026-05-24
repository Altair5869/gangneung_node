import Link from "next/link";
import { WorkSpot } from "@/types";
import { cn, noiseLabel, congestionLabel } from "@/lib/utils";

const noiseBadge: Record<WorkSpot["noise"], string> = {
  quiet: "bg-green-100 text-green-700",
  moderate: "bg-yellow-100 text-yellow-700",
  noisy: "bg-red-100 text-red-700",
};

const congestionDot: Record<"low" | "medium" | "high", string> = {
  low: "bg-green-400",
  medium: "bg-yellow-400",
  high: "bg-red-400",
};

const categoryLabel: Record<WorkSpot["category"], string> = {
  cafe: "카페",
  coworking: "코워킹",
  library: "도서관",
  hotel: "호텔",
  other: "기타",
};

export default function MapSpotCard({
  spot,
  onClose,
}: {
  spot: WorkSpot;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 z-10 overflow-hidden">
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-gray-400 font-medium">{categoryLabel[spot.category]}</span>
            {spot.congestion && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className={cn("w-1.5 h-1.5 rounded-full", congestionDot[spot.congestion])} />
                {congestionLabel(spot.congestion)}
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 text-base">{spot.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{spot.address}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 transition-colors ml-2 mt-0.5"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", noiseBadge[spot.noise])}>
          {noiseLabel(spot.noise)}
        </span>
        {spot.wifi.available && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
            WiFi {spot.wifi.speedMbps}Mbps
          </span>
        )}
        {spot.power.available && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
            콘센트
          </span>
        )}
        <span className="text-xs text-gray-400">{spot.openHours}</span>
      </div>

      <div className="grid grid-cols-2 border-t border-gray-100">
        <button
          onClick={onClose}
          className="py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          닫기
        </button>
        <Link
          href={`/spots/${spot.id}`}
          className="py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors text-center border-l border-gray-100"
        >
          자세히 보기
        </Link>
      </div>
    </div>
  );
}
