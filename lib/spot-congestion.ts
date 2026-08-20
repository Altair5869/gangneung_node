import { estimateCongestion } from "@/lib/utils";
import { WorkSpot } from "@/types";

// congestion 산출 단일 원천(2026-08-19). 목록 경로(lib/spot-corpus.ts의 buildSpotCorpus)는
// congestion을 채우는데 단건 조회 경로(lib/spot-detail.ts의 getSpotById)는 채우지 않아서,
// /spots 목록과 /spots/[id] 상세가 같은 스팟에 대해 서로 다른 데이터를 들고 있었다(QA 실측:
// 목록 HTML에 congestion 키 226개, 상세 HTML에 0개). `/spots/[id]` 히어로의 "예상 혼잡도"
// 배지와 SpecCard가 상세에서만 통째로 사라지는 것도 같은 원인이다.
//
// mergeVerifiedFields(lib/verified-spots.ts:12)가 "필드 목록이 두 곳에서 따로 유지되면 한쪽만
// 고칠 때 어긋난다"는 이유로 만들어진 것과 같은 선례를 따라, 산출 규칙을 여기 한 곳에 둔다.
//
// [데이터 규칙] CLAUDE.md 규칙 5 — 관광공사 실데이터가 있으면 그 값을, 없으면 시간대 기반
// 추정치(estimateCongestion)를 쓰고 UI에서 둘을 구분하지 않는다. 이 정책은 그대로 유지한다.
// 다만 이 값은 "표시 전용"이다 — 작업 환경 점수 채점에는 쓰지 않는다(요구사항 3-7,
// lib/ai.ts:545-547의 validateRoute가 같은 이유로 이미 제외 중인 것과 동일한 판단).
export function resolveCongestion(
  spot: Pick<WorkSpot, "id" | "tourismContentId">,
  congestionMap: Map<string, "low" | "medium" | "high">,
  plannedTime?: Date
): "low" | "medium" | "high" {
  return congestionMap.get(spot.tourismContentId ?? "") ?? estimateCongestion(spot.id, plannedTime);
}
