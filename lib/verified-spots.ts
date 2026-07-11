import verifiedSpotsData from "@/scripts/data/verified_spots.json";
import { WorkSpot } from "@/types";

// scripts/build_verified_spots.py로 spots_enriched.csv/selected_library.csv에서 빌드된,
// wifi/power/noise를 전화 확인·방문·웹 스크리닝으로 실측 완료한 24곳.
export const VERIFIED_SPOTS: WorkSpot[] = verifiedSpotsData as WorkSpot[];
