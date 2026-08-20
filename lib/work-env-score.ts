import { WorkSpot } from "@/types";
import { noiseLabel, powerLabel, wifiLabel } from "@/lib/utils";

// 작업 환경 점수 단일 원천(2026-08-19). 이전에는 components/spots/WorkEnvScore.tsx와
// components/spots/SpotsClient.tsx가 각각 calcScore를 복제 정의하고 있어서 목록 필터(60점+/80점+)와
// 상세 점수가 서로 다른 규칙으로 흘러갈 수 있었다 — 정의를 여기 하나로 모으고 두 화면이 이걸 쓴다.
//
// [데이터 규칙 핵심] CLAUDE.md 규칙 1·3에 따라 "모름(null)"은 "없음(false)"이 아니다.
// 이전 구현은 wifi.available === null, power.level === null, noise === "언급없음",
// congestion === undefined를 전부 false로 뭉개서 감점했고, 그 결과 실측 24곳(VERIFIED_SPOTS)을
// 제외한 코퍼스 대다수가 구조적으로 "0점 / 낮음 / 빨강"으로 표시됐다. 여기서는 세 상태를 끝까지
// 구분한다:
//   true  = 확인된 충족          (예: wifi.available === true)
//   false = 확인된 미충족(부정 신호) (예: power.level === "없음", noise === "언급됨-시끄러움")
//   null  = 미확인                (값이 없음 — 점수의 분자에도 분모에도 들어가지 않는다)
//
// wifi.speedMbps는 여기서도 절대 다루지 않는다(CLAUDE.md 규칙 2, 2026-07-27 제거 이력).
// 값을 새로 만들거나 추정하지 않는다 — 이 모듈은 기존 필드를 읽어 해석만 한다.
//
// [2026-08-19 개정 · 요구사항 3-7] congestion(혼잡도)은 채점 항목에서 완전히 제외한다.
// 가점·감점 어느 쪽에도 쓰지 않고 확인 항목 개수(분모)에도 넣지 않는다. 이유:
//   ① 선례 일관성 — lib/ai.ts:545-547의 validateRoute가 "실데이터와 estimateCongestion
//      추정치가 섞여 있어(CLAUDE.md 규칙 5) 검증 통과 항목에 넣으면 추정치가 사실로 승격된다"는
//      이유로 congestion을 이미 제외하고 있다. 같은 필드를 한쪽에서만 판정에 쓰면 모순이다.
//   ② 점수가 시계가 된다 — 코퍼스 226곳 중 206곳은 wifi/power가 모두 null이라 congestion이
//      유일한 확인 항목이 된다. 상대 점수(분모=확인 항목 배점 합)와 결합하면 분모가 1이 되어
//      estimateCongestion의 시간대 분기 하나가 100점/최적 ↔ 0점/낮음을 뒤집는다(QA 재현).
// congestion "표시"는 그대로 유지한다 — /spots/[id] 히어로 배지·"예상 혼잡도" SpecCard·지도
// 패널의 "예상 ○○"는 이 모듈과 무관하며 건드리지 않는다. 삭제된 건 채점 항목뿐이다.

export type CriterionKey = "wifi" | "power" | "quiet";

export interface CriterionResult {
  key: CriterionKey;
  /** 화면에 그대로 쓰는 라벨. 미확인일 때 "…미확인" 문구가 나오도록 lib/utils의 라벨 함수를 재사용한다. */
  label: string;
  /** true=확인된 충족 / false=확인된 미충족 / null=미확인 */
  state: boolean | null;
  /** 이 항목이 확인됐을 때 분모에 더해지는 배점 */
  weight: number;
  /** 실제로 획득한 점수(부분 점수 포함: 콘센트 "제한적", 혼잡도 "medium") */
  earned: number;
}

export interface WorkEnvScoreResult {
  criteria: CriterionResult[];
  /** state !== null 인 항목 수 */
  confirmedCount: number;
  /** 전체 항목 수(현재 3: wifi/power/noise. congestion은 3-7로 제외됨) */
  totalCount: number;
  /** 확인된 항목만으로 정규화한 0~100 점수. 확인된 항목이 0개면 null(판정 불가) */
  score: number | null;
  /** score가 null이면 라벨도 null — "낮음"으로 떨어뜨리지 않는다 */
  label: "최적" | "좋음" | "보통" | "낮음" | null;
}

// 배점은 기존 calcScore의 상대 비중을 그대로 유지한다(wifi 30 / power 25 / noise 25).
// 분모는 고정 만점이 아니라 "확인된 항목의 배점 합"이다.
const WEIGHTS: Record<CriterionKey, number> = {
  wifi: 30,
  power: 25,
  quiet: 25,
};

function wifiCriterion(spot: WorkSpot): CriterionResult {
  const available = spot.wifi.available;
  return {
    key: "wifi",
    label: wifiLabel(available),
    state: available === null ? null : available,
    weight: WEIGHTS.wifi,
    earned: available === true ? WEIGHTS.wifi : 0,
  };
}

function powerCriterion(spot: WorkSpot): CriterionResult {
  const level = spot.power.level;
  // "없음"은 확인된 부정 신호이므로 false(빨간 ✗) — 미확인(null)과 섞지 않는다.
  const state = level === null ? null : level !== "없음";
  const earned = level === "충분함" ? WEIGHTS.power : level === "제한적" ? 10 : 0;
  return { key: "power", label: powerLabel(level), state, weight: WEIGHTS.power, earned };
}

function quietCriterion(spot: WorkSpot): CriterionResult {
  // noise는 확정값이 아니라 신호다(CLAUDE.md 규칙 3). "언급없음"은 "시끄럽다"가 아니라 "모른다".
  const state =
    spot.noise === "언급없음" ? null : spot.noise === "언급됨-조용함";
  return {
    key: "quiet",
    label: noiseLabel(spot.noise),
    state,
    weight: WEIGHTS.quiet,
    earned: spot.noise === "언급됨-조용함" ? WEIGHTS.quiet : 0,
  };
}

export function calcWorkEnvScore(spot: WorkSpot): WorkEnvScoreResult {
  // spot.congestion은 여기서 읽지 않는다(요구사항 3-7). 이 함수의 결과는 시각에 의존하지 않아야
  // 한다 — 같은 스팟이 오전/오후에 다른 점수를 갖는 순간 그건 작업 환경 점수가 아니다.
  const criteria = [
    wifiCriterion(spot),
    powerCriterion(spot),
    quietCriterion(spot),
  ];

  const confirmed = criteria.filter((c) => c.state !== null);
  const possible = confirmed.reduce((sum, c) => sum + c.weight, 0);
  const earned = confirmed.reduce((sum, c) => sum + c.earned, 0);

  // 확인된 항목이 0개면 점수를 만들지 않는다. 0점/"낮음"으로 표기하면 "정보가 없다"가
  // "환경이 나쁘다"로 왜곡된다(완료 기준 3-3).
  const score = possible > 0 ? Math.round((earned / possible) * 100) : null;
  const label =
    score === null ? null : score >= 80 ? "최적" : score >= 60 ? "좋음" : score >= 40 ? "보통" : "낮음";

  return {
    criteria,
    confirmedCount: confirmed.length,
    totalCount: criteria.length,
    score,
    label,
  };
}

// 목록의 "60점+/80점+" 필터가 "확인 항목이 1개뿐이라 분모가 작아서 100점"인 스팟을 상위로
// 끌어올리지 않게 하는 최소 표본 조건(요구사항 3-5). 예: wifi만 true이고 나머지 전부 미확인이면
// 점수는 100이지만 확인 항목이 1개라 필터를 통과시키지 않는다.
export const MIN_CONFIRMED_FOR_SCORE_FILTER = 2;

export function passesScoreFilter(spot: WorkSpot, minScore: number): boolean {
  if (minScore <= 0) return true;
  const { score, confirmedCount } = calcWorkEnvScore(spot);
  if (score === null) return false;
  if (confirmedCount < MIN_CONFIRMED_FOR_SCORE_FILTER) return false;
  return score >= minScore;
}
