// Wilson score interval의 하한(lower bound)을 계산하는 순수 함수. Redis I/O 등 부수효과와
// 완전히 분리해 단위 테스트 가능하게 한다(요구사항 R3-3). 표본이 적을 때 우연히 높게 나온
// 비율(예: 3건 중 3건 "있음" = 100%)을 그대로 신뢰하지 않기 위해, 상한이 아니라 95% 신뢰수준
// 하한을 승격 기준으로 쓴다 — 표본이 늘어날수록 하한이 실제 비율에 가까워진다.
//
// 산술 검증(요구사항 문서 4-④): z=1.96 기준 만장일치(전부 긍정)여도 하한이 0.6을 넘으려면
// n≥6이 필요하다(n=3 → ≈0.44, n=5 → ≈0.57, n=6 → ≈0.61). 표본이 적으면 만장일치여도 승격
// 임계값(WIFI_CONFIRM_THRESHOLD, lib/community-checkin.ts)을 못 넘는 것은 버그가 아니라
// Wilson interval의 정상 동작이다.

export const WILSON_Z = 1.96; // 95% 신뢰수준

/**
 * @param positive 긍정 응답 수 (예: wifiYes, 또는 대칭 판정 시 wifiNo)
 * @param total 전체 응답 수 (양쪽 방향 합계, 예: wifiYes + wifiNo)
 * @param z 신뢰수준에 대응하는 z-score. 기본값은 95% 신뢰수준(WILSON_Z).
 * @returns Wilson score interval 하한 (0~1). total이 0이면 표본이 없으므로 0을 반환한다.
 */
export function wilsonLowerBound(positive: number, total: number, z: number = WILSON_Z): number {
  if (total <= 0) return 0;
  const p = positive / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  return Math.max(0, (centre - margin) / denominator);
}
