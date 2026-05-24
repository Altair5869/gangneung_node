import { MOCK_SPOTS } from "@/lib/spots-data";
import KakaoMap from "@/components/map/KakaoMap";

export default function MapPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <KakaoMap spots={MOCK_SPOTS} />
    </div>
  );
}
