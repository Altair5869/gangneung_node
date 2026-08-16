import { LifeSpot } from "@/types";
import { categoryLabel } from "@/lib/spot-visuals";

// WorkSpot 전용 MapSpotCard(wifi/power/noise/openHours 배지, /spots/[id] 링크)를 LifeSpot에
// 그대로 못 쓴다 — LifeSpot 타입엔 이 필드들이 아예 없고, /attraction/[id] 같은 상세 페이지도
// 존재하지 않는다(요구사항 문서 3번, AC5). 그래서 이름/카테고리/주소/설명만 보여주는 경량 카드를
// 별도로 둔다. "자세히 보기" 같은 링크는 의도적으로 넣지 않는다 — 깨진 링크를 만들 바에야 없는
// 게 낫다.
export default function MapLifeSpotCard({
  spot,
  onClose,
}: {
  spot: LifeSpot;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-background rounded-2xl shadow-xl border border-border z-10 overflow-hidden">
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <span className="text-xs text-foreground/60 font-medium">{categoryLabel[spot.category]}</span>
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

      {spot.description && (
        <p className="px-4 pb-3 text-sm text-foreground/70 line-clamp-3">{spot.description}</p>
      )}

      <div className="border-t border-border">
        <button
          onClick={onClose}
          className="w-full py-3 text-sm text-foreground/70 hover:bg-muted transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
