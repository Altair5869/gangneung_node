import verifiedSpotsData from "@/scripts/data/verified_spots.json";
import { WorkSpot } from "@/types";

// scripts/build_verified_spots.py로 spots_enriched.csv/selected_library.csv에서 빌드된,
// wifi/power/noise를 전화 확인·방문·웹 스크리닝으로 실측 완료한 24곳.
export const VERIFIED_SPOTS: WorkSpot[] = verifiedSpotsData as WorkSpot[];

// /api/spots(lib/spot-corpus.ts의 buildSpotCorpus)와 /api/spots/[id]가 동일한 실측 데이터
// override 로직을 각자 구현하면서 barrierFree 병합이 한쪽에서만 빠지는 사고가 났다
// (2026-07-28, 코드 리뷰 발견 버그 1). 두 경로 모두 이 함수 하나로 병합하게 해서 필드 목록이
// 어긋날 여지를 없앤다. verified가 없으면(실측 데이터 없는 스팟) 원본을 그대로 반환한다.
export function mergeVerifiedFields(spot: WorkSpot, verified: WorkSpot | undefined): WorkSpot {
  if (!verified) return spot;
  return {
    ...spot,
    wifi: verified.wifi,
    power: verified.power,
    noise: verified.noise,
    barrierFree: verified.barrierFree ?? spot.barrierFree,
    tags: Array.from(new Set([...spot.tags, ...verified.tags])),
  };
}
