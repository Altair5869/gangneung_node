import KakaoMap from "@/components/map/KakaoMap";
import { WorkSpot } from "@/types";

async function getSpots(): Promise<WorkSpot[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/spots`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.spots ?? [];
}

export default async function MapPage() {
  const spots = await getSpots();
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <KakaoMap spots={spots} />
    </div>
  );
}
