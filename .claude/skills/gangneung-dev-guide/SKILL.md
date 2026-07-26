---
name: gangneung-dev-guide
description: 강릉 노드(Next.js App Router, TypeScript) 코드를 작성/수정하기 전 반드시 확인할 프로젝트 고유 제약 가이드. WorkSpot 데이터 필드(wifi/power/noise/barrierFree) 하드코딩 금지, 하버사인 거리 계산 재사용, LangGraph 코드 기반 검증 패턴, Next.js breaking change 확인 절차를 담는다. developer 에이전트가 강릉 노드에서 코드를 작성할 때마다 사용한다.
---

# 강릉 노드 개발 가이드

이 프로젝트는 관광 데이터의 실제 진위 여부가 공모전 심사 기준("공사 OpenAPI 활용")과 직결된다. 편의를 위해 하드코딩하면 필터가 무의미해지고 심사에서 신뢰도가 깎인다 — 실제로 이미 한 번 발생했던 문제다(`docs/DATA_STATUS.md`의 "히스토리" 절 참고).

## 1. Next.js 버전 확인 (코드 작성 전 1회)

`AGENTS.md`가 이 저장소의 Next.js가 표준과 다른 breaking change를 포함한다고 명시한다. 새 API를 쓰기 전:

1. `node_modules/next/`가 없으면 먼저 `npm install`을 제안한다 (설치 안 된 상태로 짐작해서 코드를 쓰지 않는다)
2. `node_modules/next/dist/docs/`에서 관련 API 문서를 확인한다
3. 문서에 해당 API가 없거나 확인이 어려우면, 학습 데이터 기준 표준 API보다 이미 이 코드베이스에서 쓰이고 있는 패턴(기존 `app/api/*/route.ts` 파일들)을 그대로 따라간다 — 검증된 패턴이 가장 안전하다

## 2. WorkSpot 데이터 필드 — 절대 규칙

새 데이터 매핑 함수를 작성하거나 기존 필드를 다루는 로직을 고칠 때:

| 필드 | 하면 안 되는 것 | 해야 하는 것 |
|---|---|---|
| `wifi.available` | 매핑 함수에서 `true`/`false` 고정값 할당 | 실측 없으면 `null` 초기화. 실측은 `lib/verified-spots.ts`의 `VERIFIED_SPOTS` override 병합 패턴을 통해서만 채워짐 |
| `wifi.speedMbps` | 필드에 값을 넣거나 검증/필터 조건에 사용 | 존재하지만 항상 `null`. 이 필드를 참조하는 새 코드를 추가하지 않는다 |
| `power.level` | `boolean`으로 취급하거나 임의 문자열 할당 | `"충분함" \| "제한적" \| "없음" \| null` 3단계만 사용 |
| `noise` | `quiet`/`noisy` 같은 확정 라벨 생성, 또는 "언급없음"을 "없음"으로 확대 해석 | `"언급됨-조용함" \| "언급됨-시끄러움" \| "언급없음"` 신호로만 다룸 |
| `barrierFree` | — | 실데이터이므로 검증 조건에 그대로 사용 가능 (`lib/tourism-mapper.ts`의 `parseBarrierField`) |
| `congestion` | 실데이터/추정치를 UI에서 구분 표시 (현재 정책과 다름) | 구분 없이 사용. 정책을 바꾸려면 먼저 pm-analyst에게 확인 |

새 필드를 관광공사/카카오 API 매핑 함수(`lib/tourism-mapper.ts`, `lib/kakao-local-api.ts` 계열)에 추가할 때는 항상 "모르면 null"을 기본값으로 삼는다.

## 3. 거리 계산 — 하버사인만 사용

위경도로 실제 거리를 계산해야 하면 `lib/ai.ts`의 `calculateHaversineDistance(lat1, lng1, lat2, lng2)`를 재사용한다. `Math.hypot(latDiff, lngDiff)`로 직접 계산하지 않는다 — 위도 37.75°N 기준 경도 1도(≈88.1km)가 위도 1도(≈111.3km)보다 짧아서, 유클리드 거리로는 방문 순서가 실제와 달라진다. `scripts/test-haversine.mjs`를 실행하면 실제 오차 사례를 볼 수 있다:

```
node scripts/test-haversine.mjs
```

## 4. AI 큐레이션 검증 — 코드 기반, self-critique 아님

`preferences`(무장애, 콘센트 등) 검증 로직을 추가/수정할 때, LLM에게 "이 결과 괜찮아?"라고 다시 묻는 방식을 쓰지 않는다. `lib/ai.ts`의 `validateRoute` 패턴처럼 boolean/숫자 비교로 코드에 명시한다. 검증 가능한 항목과 그렇지 않은 항목(`docs/AGENT_DESIGN.md`의 매핑표)을 구분해서, 구조화 안 된 필드(`tags` 등)에 임계값을 걸지 않는다.

## 5. LifeSpot은 예외

`RouteStop`이 `LifeSpot`(`isLifeSpot(s) === true`)이면 wifi/power/noise/barrierFree 필드 자체가 없으므로 이 규칙들을 적용하지 않는다 — 검증 로직에서 건너뛰어야 한다.

## 6. 완료 후

변경 파일 목록과 QA가 특히 확인해야 할 지점(예: "이 매핑 함수가 null을 기본값으로 쓰는지")을 정리해 `.claude/_workspace/02_developer_changes.md`에 쓰고 qa-engineer에게 전달한다.
