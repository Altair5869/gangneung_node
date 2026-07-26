---
name: gangneung-qa-checklist
description: 강릉 노드 기능 QA 체크리스트. WorkSpot 데이터 필드 하드코딩 탐지, API↔프론트 경계면 교차 검증, 하버사인 거리/AI 검증 로직 정확성 확인 절차를 담는다. 강릉 노드에서 기능 구현 완료 후 QA 요청, 또는 "검증해줘"/"확인해줘"/"버그 없는지 봐줘" 요청 시 qa-engineer 에이전트가 사용한다.
---

# 강릉 노드 QA 체크리스트

"코드가 있는가"가 아니라 "코드가 실제로 규칙을 지키는가"를 확인한다. 각 항목은 grep/파일 대조로 직접 검증하고, 추측으로 PASS를 주지 않는다.

## A. 데이터 필드 하드코딩 탐지

```bash
# wifi.available / power.level에 고정값이 들어가는 곳 찾기 (VERIFIED_SPOTS override 메커니즘 외부에서)
grep -rn "available:\s*true\|available:\s*false" lib/ app/ --include="*.ts" --include="*.tsx"
grep -rn "level:\s*[\"']충분함[\"']\|level:\s*[\"']제한적[\"']\|level:\s*[\"']없음[\"']" lib/ app/ --include="*.ts"

# wifi.speedMbps가 값이 할당되거나 검증/필터 조건에 쓰이는지
grep -rn "speedMbps" lib/ app/ components/ --include="*.ts" --include="*.tsx"

# noise가 확정 라벨(quiet/noisy)로 오용되는지
grep -rn "\"quiet\"\|\"noisy\"\|'quiet'\|'noisy'" lib/ app/ components/ --include="*.ts" --include="*.tsx"
```

- `lib/verified-spots.ts`(`VERIFIED_SPOTS`) 내부의 값 할당은 실측 데이터이므로 정상 — 이건 하드코딩이 아니다
- 그 외 위치에서 매칭되면 왜 있는지 확인. 새로 추가된 코드라면 FIX 판정

## B. 거리 계산 검증

```bash
# 위경도 거리 계산에 Math.hypot이 쓰이는 곳 (테스트 스크립트 제외)
grep -rn "Math.hypot" lib/ app/ --include="*.ts" --include="*.tsx"
```

- `lib/ai.ts`의 `calculateHaversineDistance` 외에 새로 작성된 거리 계산 코드가 있으면, `Math.hypot`을 직접 쓰지 않고 `calculateHaversineDistance`를 재사용하는지 확인
- 재사용하지 않으면 FIX — 순서가 실제와 달라질 수 있음 (`scripts/test-haversine.mjs`로 재현 가능)

## C. AI 검증 로직이 코드 기반인지 확인

`lib/ai.ts`의 `validateRoute`(또는 신규 검증 함수)를 읽고:
- boolean/숫자 비교로 구현됐는지 (예: `power.level === "충분함" || power.level === "제한적"`)
- LLM을 재호출해서 "이 결과 괜찮아?"라고 묻는 self-critique 패턴이 섞여 있지 않은지
- `LifeSpot`(`isLifeSpot(s)`)에 대해 wifi/power/noise/barrierFree 검증을 건너뛰는지

## D. API ↔ 프론트 경계면 교차 검증

**반드시 양쪽을 동시에 읽는다** — 한쪽만 보고 판정하지 않는다.

| 검증 대상 | 왼쪽 (생산자) | 오른쪽 (소비자) |
|---|---|---|
| `/api/spots` 응답 shape | `app/api/spots/route.ts`의 `NextResponse.json()` | `components/spots/SpotsClient.tsx`, `SpotCard.tsx`가 기대하는 타입 |
| 필터 쿼리 파라미터 | `components/spots/SpotFilter.tsx`의 `noise`/`wifi`/`power`/`barrierFree` 쿼리 값 | 실제 필터링 로직(`app/api/spots/route.ts` 또는 클라이언트 필터링 코드)에서 해당 파라미터를 소비하는지 |
| null 필드의 필터 동작 | `wifi.available`/`power.level`이 `null`인 스팟 | 필터를 켰을 때 이 스팟들이 "미확인이라 제외"되는지 (의도된 동작, "버그"로 오판하지 않기) — `docs/DATA_STATUS.md`의 "히스토리" 절 참고 |
| AI 큐레이터 preferences | `app/ai-curator/page.tsx`의 `PREFERENCE_OPTIONS` | `lib/ai.ts` `filterByPreferences`/`validateRoute`가 실제로 검증하는 항목과 일치하는지 (`docs/AGENT_DESIGN.md`의 매핑표: "빠른 WiFi"/"뷰 좋은 곳"/"카페인 충전 가능"은 검증 대상 아님이 정상) |

## E. Next.js 호환성 (best-effort)

developer가 새로 쓴 API가 이 저장소의 Next.js 버전에서 표준과 다르게 동작할 가능성이 있는지 `node_modules/next/dist/docs/`(있으면) 또는 기존 코드 패턴과 대조해 확인한다. 확인 불가능하면 "미검증" 명시 — PASS로 임의 판정하지 않는다.

## 판정 기준

- **PASS**: 위 항목 모두 통과, 또는 해당 요청과 무관해 검증 대상 아님
- **FIX**: 특정 파일:라인의 부분 수정으로 해결 가능
- **REDO**: 접근 방식 자체를 다시 설계해야 함 (예: 필드 타입 설계가 통째로 규칙 위반)
- **검증 불가**: 구조화 안 된 기준(예: "뷰 좋은 곳")이라 PASS/FAIL을 매길 수 없음 — 명시만 하고 넘어감

## 점진적 QA

기능 하나가 완성될 때마다 위 체크리스트를 돌린다. 여러 기능을 모아뒀다가 한 번에 검증하지 않는다 — 초기 경계면 불일치가 후속 코드에 전파되는 것을 막기 위함이다.
