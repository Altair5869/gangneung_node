# AI 에이전트 설계

`curateRoute`(`lib/ai.ts`)를 단일 프롬프트 호출에서 2노드 LangGraph 워크플로우로 바꾸는 설계. 4노드가 아니라 2노드로 좁힌 이유: 스팟 규모가 30~50곳 수준이라 노드를 늘리면 레이턴시만 늘고 검증 기준이 불명확해짐.

## 왜 필요한가 (LLM 호출을 늘리는 게 아니라 코드 검증을 추가하는 이유)

과거 `curateRoute`에는 `preferences`(무장애, 콘센트 등)를 지켰는지 확인하는 코드가 없었고, 거리 계산도 위경도 차이를 `Math.hypot`으로 재는 부정확한 방식(현재는 `calculateHaversineDistance`로 교체되어 제거됨)이었다. 이 설계 문서는 그 두 결함을 코드 검증으로 메우기 위해 작성됐다(이 결함은 아래 "노드 구조"/"Node 1/2 구현 상태" 절에서 이미 해소됨).

## 노드 구조

**Node 1 — 생성**
지금의 `curateRoute` 로직 (RAG 검색 붙인 버전). 입력: `CurationRequest` + 검색된 후보 스팟. 출력: `CurationRoute`.

**Node 2 — 검증 (코드 기반, LLM 재호출 아님)**
아래 조건을 코드로 체크한다. 하나라도 실패하면 실패 이유를 프롬프트에 追가해서 Node 1을 재호출한다.

## preferences ↔ 필드 매핑

`PREFERENCE_OPTIONS`(`app/ai-curator/page.tsx`)는 5개다. 그중 검증 가능한(사실·신호 기반으로 코드가 확인할 수 있는) 3개만 검증 대상으로 한다(`CHECKABLE_PREFERENCES`, `lib/ai.ts`). "빠른 WiFi"는 애초에 옵션 목록에도 없다(수집 불가 필드이므로 제거됨) — 아래 표는 참고용으로 "만약 있었다면 검증 불가였을 항목"까지 포함해 6행으로 정리했다.

| preference 값 | 검증 여부 | 사전 필터(`filterByPreferences`) 조건 | 검증(`validateRoute`) 조건 | 비고 |
|---|---|---|---|---|
| "조용한 환경" | 검증함 (신호 기반) | `noise !== "언급됨-시끄러움"` | `noise === "언급됨-시끄러움"`이면 위반 | 확정된 사실이 아니라 웹 스크리닝(블로그/후기 검색엔진 스니펫) 커뮤니티 신호이므로(CLAUDE.md 데이터 규칙 3), "언급없음"(미확인)은 필터·검증 양쪽에서 통과시킨다 — **확정된 "시끄러움" 신호만 배제**하는 기준으로 두 단계를 통일했다(2026-07-27, 아래 "필터-검증 정합성 결정" 절 참고). UI엔 "조용함 언급"이라고 표시해 확정 사실처럼 보이지 않게 함 |
| "빠른 WiFi" | **검증 안 함, 조건 자체 삭제** | — | — | wifi 속도(Mbps)는 전화로도 블로그로도 확인 불가능. 이 조건을 만들면 안 되는 데이터에 임계값을 거는 것이 됨. `lib/ai.ts`에 이 조건 자체가 없음 (구현 완료) |
| "콘센트 필수" | 검증함 (사실 기반) | `power.level === "충분함" \|\| power.level === "제한적"` (`null` 제외) | 동일 조건, `null`도 **위반 처리** | 전화 확인/방문/웹 스크리닝으로 채운 값이라 CLAUDE.md 데이터 규칙 1에 따라 검증 조건에 그대로 사용 가능. `power.level`이 2026-07-11에 `available: boolean` → 3단계 신호(`"충분함"\|"제한적"\|"없음"\|null`)로 바뀌면서 조건도 같이 바뀜. **`null`(미확인)은 필터·검증 양쪽에서 "필수" 조건 불충족으로 취급** — noise와 달리 사실 확인이 가능한 필드이므로, 확인 안 된 곳을 "필수 조건 충족"으로 쳐주지 않는다(2026-07-27 재확인, 아래 "필터-검증 정합성 결정" 절 참고) |
| "무장애 접근 가능" | 검증함 (사실 기반) | `isBarrierFree(barrierFree)` (`barrierFree?.exit === true`) | 동일 조건 | 실데이터이므로 엄격하게 검증 |
| "뷰 좋은 곳" | 검증 안 함 | — | — | 구조화 필드 없음, `tags` 매칭은 스팟마다 태그가 일관되지 않아 랜덤 통과/실패가 됨 |
| "카페인 충전 가능" | 검증 안 함 | — | — | 위와 동일 |

**검증 조건 두 종류를 구분한다.** "콘센트 필수", "무장애 접근 가능"은 사실 기반(fact-based) — 전화로 확인되는 예/아니오다. "조용한 환경"은 신호 기반(signal-based) — 커뮤니티 후기에 그런 언급이 있었는지일 뿐, 그 시각 그 장소가 실제로 조용한지 보장 안 한다. 이 둘을 UI에서 같은 방식으로("무장애 접근 가능" 배지처럼) 표시하면 안 된다.

## 필터-검증 정합성 결정 (2026-07-27)

PRD 검토 중 `filterByPreferences`(사전 필터)와 `validateRoute`(Node 2 검증)가 "조용한 환경"·"콘센트 필수" 두 조건에서 서로 다른 기준을 쓰는지 점검했다. 결론: **"조용한 환경"은 기준이 어긋나 있었고(수정함), "콘센트 필수"는 이미 일치했다(문서만 정정).**

### "조용한 환경" — 필터를 검증 기준에 맞춰 통일

- **문제**: `filterByPreferences`는 `noise === "언급됨-조용함"`만 통과시켜 "언급없음"(미확인) 스팟을 사전 후보군에서 배제했다. 반면 `validateRoute`는 `noise === "언급됨-시끄러움"`일 때만 위반 처리해 "언급없음"을 통과시켰다. CLAUDE.md 데이터 규칙 3("noise는 확정 사실이 아니라 신호")에 비추어 보면, 미확인 신호를 근거로 필터 단계에서부터 배제하는 것은 규칙 취지와 어긋난다 — 확정 안 된 정보로 "탈락"이라는 확정적 판단을 내리는 셈이기 때문이다.
- **결정**: `filterByPreferences`를 `validateRoute`와 같은 기준(`noise !== "언급됨-시끄러움"`, 즉 확정된 "시끄러움" 신호만 배제)으로 통일했다. `lib/ai.ts`의 `filterByPreferences` 수정.
- **실측 효과 확인** (로컬 dev, `GET /api/spots` 실호출, 2026-07-27 기준 전체 231곳/숙소 제외 216곳):

  | 시나리오 | 변경 전 (구 기준) | 변경 후 (신 기준) |
  |---|---|---|
  | "조용한 환경" 단독 | 6곳 통과 | 214곳 통과 |
  | "조용한 환경" + "콘센트 필수" 동시 선택 | **4곳 통과 (5곳 미만 → `filtered.length >= 5 ? filtered : spots` 폴백 발동, 두 조건 전부 무시됨)** | 11곳 통과 (폴백 미발동, 두 조건 모두 적용된 채 후보 유지) |

  실측 노이즈 분포(숙소 제외 216곳): `언급없음` 208 / `언급됨-조용함` 6 / `언급됨-시끄러움` 2. 구 기준에서는 "조용함 확정" 6곳만 후보가 될 수 있어 다른 조건과 조합하면 P2 폴백(전체 조건 무시)이 쉽게 발동했다. 신 기준에서는 "확정 시끄러움" 2곳만 제외되므로 폴백 발동 가능성이 크게 줄어든다 — 이 폴백 자체(P2)는 이번 스코프가 아니지만, 이번 정합성 수정이 폴백 발동 빈도를 실질적으로 낮추는 부수 효과가 있음을 확인했다.

### "콘센트 필수" — 코드 유지, 문서만 정정

- **문제**: 이 문서(위 매핑표)가 예전에 "`null`인 스팟은 건너뜀"이라고 서술했지만, `validateRoute`/`filterByPreferences` 코드는 실제로 `null`을 위반/탈락으로 처리하고 있었다 — 문서가 stale했다.
- **결정**: 코드를 바꾸지 않고 문서를 코드에 맞춰 정정했다. 근거: CLAUDE.md 데이터 규칙 1이 `power.level`을 "전화 확인이나 직접 방문으로 사실 확인이 가능하므로 검증 조건에 사용해도 된다"고 명시한다 — `noise`(신호)와 달리 사실(fact)로 취급하기로 이미 정해진 필드다. 사용자가 "콘센트 필수"를 명시적으로 요청했는데 확인이 안 된 곳(`null`)을 "충족"으로 처리하면 필수 조건의 의미가 약해진다. `filterByPreferences`와 `validateRoute`가 이미 같은 기준(`null` 제외)을 쓰고 있어 필터-검증 정합성 자체는 문제가 없었다.

**미확정 항목**: `wifi.speedMbps` 임계값 논의는 폐기함. 이제 논의할 필요 없음.

## 거리 검증 (구현 완료, 2026-07-14)

1. 거리 계산은 하버사인 공식(`calculateHaversineDistance`)을 쓴다.
2. `duration`(2/4/6/8시간)별 총 이동거리 임계값을 순차 합 방식으로 검증한다 (`lib/ai.ts` `totalSequentialDistance`). 순차 합을 택한 이유: LLM이 반환한 `order` 배열이 곧 실제 방문 순서이고, 순차 합은 그 순서 그대로 사용자가 이동할 거리를 반영하는 게 "하루 동선" 개념과 가장 잘 맞음 (반경 방식은 방문 순서와 무관한 면적 지표라 실제 이동 부담을 안 나타냄).

| duration | 총 이동거리 임계값 |
|---|---|
| 2시간 | 8km |
| 4시간 | 10km |
| 6시간 | 13km |
| 8시간 | 16km |

**실측 재보정 (2026-07-14)**: 최초 제안치(2h→3km, 4h→6km...)로 로컬 dev 서버에서 실제 호출해보니, 선호조건 없는 정상 케이스도 총 이동거리가 5.7~6.8km로 나와 거의 절반이 오탐(불필요한 `validationNote` 노출)이었음. 관측된 정상 범위의 약 1.5~2배로 임계값을 상향해 실제 동떨어진 스팟이 섞였을 때만 걸리도록 재보정함.

## 검증 대상에서 제외

`RouteStop`이 `LifeSpot`(`isLifeSpot(s) === true`)이면 wifi/power/noise/barrierFree 검증을 건너뛴다. `LifeSpot` 타입에는 이 필드들이 없다.

## 재시도 정책

- 최대 재시도 횟수: 2회 (`MAX_ATTEMPTS = 3`, `lib/ai.ts`. 확정·구현 완료, 2026-07-14 — 무한 루프 방지 + Claude API 비용 고려)
- 재시도 시 실패 이유(예: "무장애 조건 위반: 스팟 X")를 다음 프롬프트에 명시적으로 넣는다. 이유 없이 같은 프롬프트로 재호출하면 같은 결과가 나올 확률이 높다.
- 2회 다 실패하면: 에러를 던지지 않고 "일부 조건을 만족하는 동선을 찾지 못해 근접한 결과를 보여드립니다"라는 안내와 함께 마지막 결과를 반환한다 (확정·구현 완료, `validationNote`, `lib/ai.ts` `curateRoute` 내 `result.valid`가 `false`일 때 분기).
- **재시도 시 후보 집합은 고정된다 (의도된 트레이드오프, 2026-07-27 결정).** 자세한 근거는 아래 "재시도 시 후보 고정 결정" 절 참고.

## wifi/power/noise 실측 확보 — 실제 진행 방식 (2026-07-11 완료, 아래는 계획이 아니라 실적)

**적용 범위**: 최종 **24곳** (카페 18 + 호텔 5 + 도서관 1). 원래 30곳을 후보로 봤으나, 워케이션 부적합/wifi 미확인 6곳(심야 펍, 라운지바, wifi 없는 카페, 확인 안 되는 작은도서관 등)을 세션 중 제외하고 24곳으로 확정함.

**실제로 쓴 절차** ([[feedback_data_sourcing]] 메모리와 동일): ① 웹 스크리닝(Claude가 WebSearch로 공식 채널·다이닝코드 등 예약 플랫폼 시설정보 태그 확인) → ② 안 나오면 사용자가 전화/방문으로 직접 확인 → ③ 그래도 안 맞으면 스팟을 후보에서 제외.

**wifi.available**: 24곳 전부 웹 스크리닝 또는 사용자 확인으로 `true` 확정. 아래에서 계획했던 `wifi.communitySignal` 분리 필드는 **만들지 않았다** — wifi는 전화/방문으로 사실 확인이 가능한 속성이라 굳이 신호(signal)와 사실(fact)을 나눌 필요가 없었고, `wifi.available`에 직접 사실 기반 값을 기록했다.

**power.level**: 카페 18곳은 사용자가 직접 전화/방문으로 콘센트 상태를 확인했고, "있다/없다"로 안 갈리고 넉넉함/적음/없음 스펙트럼이 나와서 `power.level: "충분함"|"제한적"|"없음"|null` 3단계 신호로 스키마를 바꿨다 (원래 `power.available: boolean`이었음). 호텔 5곳·도서관 1곳은 객실/열람실 특성상 "충분함"으로 간주해 확정 (개별 확인은 안 함).

**noise**: **네이버 검색 오픈API 대신 WebSearch 도구로 대체 진행**했다. 아래 "금지 사항"·"3단계 라벨" 원칙 자체는 그대로 지켰지만, 네이버 블로그 검색 API를 호출하는 별도 스크립트는 만들지 않고, Claude가 WebSearch로 검색엔진에 노출된 블로그/다이닝코드/부킹닷컴 스니펫만 근거로 삼아 직접 분류했다. 결과: 조용함 5곳, 시끄러움 4곳, 나머지 15곳은 검색 결과 없음 또는 조용함/시끄러움 태그가 상충해 "언급없음"으로 보수적으로 남김.

**금지 사항 (계속 유효)**: 네이버 지도/카카오맵 리뷰 페이지 직접 크롤링·WebFetch. 이용약관 위반 소지. WebSearch가 검색 결과로 지도 URL을 보여줘도 그 URL은 열지 않고 스니펫 텍스트만 사용한다.

**3단계 라벨** (noise, 실제로 쓴 기준):

| 라벨 | 조건 |
|---|---|
| `언급됨-조용함` | 검색 스니펫에 "조용해요", "조용해서 좋다" 등 명시적 표현 |
| `언급됨-시끄러움` | 검색 스니펫에 "시끄러워요", "시끌벅적한 태그 압도적" 등 명시적 표현 |
| `언급없음` | 검색 결과 없음, 또는 조용함/시끄러움 신호가 상충 |

**데이터 흐름**: `scripts/data/spots_enriched.csv`/`selected_library.csv`에 사람이 직접(또는 Claude가 웹 스크리닝 결과를 받아 적어서) wifi_real/power_real/noise_signal을 채우면, `scripts/build_verified_spots.py`가 `candidates_*.csv`의 위경도와 조인해서 `scripts/data/verified_spots.json`을 만들고, `lib/verified-spots.ts` → `app/api/spots/route.ts`/`app/api/spots/[id]/route.ts`가 관광공사/카카오 실시간 응답에 override 병합한다. 자세한 스키마 상태는 `docs/DATA_STATUS.md` 참고.

## 확정된 설계 결정 이력 (과거 미확정 항목, 전부 해소됨)

1. duration별 거리 임계값 4개 숫자 → (구현 완료, 위 "거리 검증" 절 참고)
2. 거리 계산: 순차 합 vs 반경 → 순차 합으로 확정 (구현 완료, 위 "거리 검증" 절 참고)
3. 재시도 실패 시 동작: fallback 문구 vs 에러 → fallback 문구(`validationNote`)로 확정 (구현 완료, 위 "재시도 정책" 절 참고)
4. wifi 커뮤니티 신호(네이버 API) vs 직접 조사만 사용 최종 선택 → **확정됨 (2026-07-11)**: 직접 조사(웹 스크리닝 + 전화/방문 확인)만 사용. `wifi.communitySignal` 필드는 만들지 않음. noise도 네이버 API 대신 WebSearch로 대체 진행 — 위 "wifi/power/noise 실측 확보" 절 참고

현재 미확정 항목은 0개다.

## Node 1/2 구현 상태 (2026-07-14 갱신)

"노드 구조"·"거리 검증"·"재시도 정책" 절이 **구현 완료됨** (`lib/ai.ts`, 커밋 `f03ed24`). `preFilter`(사전 필터링)는 기존과 동일하게 후보를 좁히고, `generateOnce`(Node 1) → `validateRoute`(Node 2, 코드 기반) 검증을 최대 3회(최초 1회 + 재시도 2회)까지 돈다. 실패 사유는 다음 `generateOnce` 호출의 프롬프트에 포함되어 같은 실수를 반복하지 않도록 유도한다. 3회 모두 실패하면 `CurationRoute.validationNote`에 안내 문구를 채워 반환하고, `app/ai-curator/page.tsx`가 이를 노란 배너로 표시한다.

## LangGraph 실제 도입 (2026-07-20)

위 "노드 구조"는 2026-07-14까지 수작업 `for` 루프(`generateOnce`→`validateRoute`→재시도)로만 구현되어 있었다. 이번에 `@langchain/langgraph`의 `StateGraph`로 그 루프를 명시적 그래프로 전환했다 (`lib/ai.ts`의 `CurationState`/`generateNode`/`validateNode`/`routeAfterValidate`/`curationGraph`).

- 상태(`CurationState`): `request`, `workSpots`, `lifeSpots`, `route`, `valid`, `reasons`, `attempt`
- 노드: `generate`(Node 1, `generateOnce` 호출) → `validate`(Node 2, `validateRoute` 호출, self-critique 아닌 코드 기반 검증은 기존과 동일)
- 조건부 엣지(`routeAfterValidate`): `valid`면 종료, `attempt >= MAX_ATTEMPTS(3)`면 종료, 그 외엔 `generate`로 재진입
- 로직 자체(검증 조건, 재시도 횟수, 거리 임계값)는 전혀 안 바뀜 — 기존 함수(`generateOnce`, `validateRoute`)를 그대로 노드 본문으로 재사용했고, 제어 흐름만 `for` 루프에서 그래프로 옮겼다.

## RAG: 벡터 검색 사전 색인화 (2026-07-20)

**문제**: `rankCandidates`(자유 텍스트 큐레이션)가 매 요청마다 `filterByPreferences`를 통과한 후보 전체(관광공사+카카오 실시간 병합 결과, 많으면 ~200곳)를 Voyage API로 재임베딩하고 있었다. 코퍼스가 24곳짜리 정적 목록이 아니라 `/api/spots`가 매번 조립하는 200+ 규모 동적 목록이라, 자유 텍스트 요청 1건당 "쿼리 1건 + 문서 최대 200건" 임베딩 API 호출이 반복되는 구조였다.

**해결**: `lib/vector-store.ts`로 Upstash Vector를 연동해 코퍼스를 사전 색인화했다.
- `reindexSpots`: 전체 워크스팟 코퍼스(`lib/spot-corpus.ts`의 `buildSpotCorpus`)를 배치(50건씩)로 Voyage 문서 임베딩 → Upstash Vector에 upsert. `/api/cron/reindex-spots`(Vercel Cron, 매일 KST 03:00, `vercel.json`)가 호출한다.
- `queryTopK`: 사용자 자유 텍스트 **쿼리 1건만** 임베딩해 Upstash Vector에 유사도 검색. 색인 미설정(`UPSTASH_VECTOR_REST_URL`/`TOKEN` 없음)이거나 검색 실패 시 `null`을 반환한다.
- `lib/ai.ts`의 `rankCandidates`가 `queryTopK`를 우선 시도하고, `null`이면 기존 `semanticSort`(요청마다 후보 전체 재임베딩)로 폴백한다 — 이 폴백 경로 덕분에 Upstash 설정 여부와 무관하게 기능이 항상 동작한다.

**신선도 트레이드오프**: 관광공사/카카오 API 응답이 실시간으로 바뀔 수 있어 색인과 실제 후보 목록이 완전히 일치하지 않을 수 있다. `rankCandidates`는 벡터 검색으로 받은 id를 현재 요청의 후보 목록(`byId` Map)과 대조해 존재하는 것만 채택하고, 색인에 없거나(신규 스팟) 검색에 안 걸린 나머지는 뒤에 그대로 이어붙여 후보가 누락되지 않게 한다. "완전한 실시간 동기화"가 아니라 "주기적 재색인 + 결측 시 안전한 폴백"을 택했다.

**필요 환경변수**: `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN` (Upstash Vector 콘솔, 인덱스 차원 1024 — voyage-4-lite 실측값), `CRON_SECRET`(임의 문자열, Vercel이 크론 호출 시 `Authorization: Bearer $CRON_SECRET`으로 자동 인증).

## 재색인 실행시간 한도 (2026-07-27 측정·결정)

**측정 배경**: PRD 검토 중 "코퍼스 200곳/4배치 가정으로 최악의 경우 수 분이 걸릴 수 있는데 `maxDuration` 선언이 코드베이스 전체에 0건"이라는 리스크가 지적됐다. 직전 QA 세션의 "정상 케이스 4.0초 완주" 기록이 있었으나, `reindexSpots`(`lib/vector-store.ts`)는 배치 사이마다 `BATCH_GAP_MS=3000`(3초) `sleep`을 거는 구조라 배치가 2개 이상이면 산술적으로 4초에 끝날 수 없다 — 그 기록을 그대로 신뢰하지 않고 재측정했다.

- **실제 코퍼스 규모**: `GET /api/spots` 실호출 결과 **231곳** (`buildSpotCorpus()` 반환 개수, 2026-07-27 기준). `EMBED_BATCH_SIZE=50`이므로 배치 수는 **5개**(50×4 + 31) — PRD가 가정한 "200곳/4배치"보다 1배치 많다.
- **정상 경로 실측치**: 로컬 dev 서버에서 실제 `CRON_SECRET`으로 `GET /api/cron/reindex-spots`를 1회 재실행(Voyage/Upstash 실호출, 429 없음) → `200 {"upserted":231}`, **82초**(dev 로그 `82s` 그대로). 배치 간 대기만 4회×3초=12초이고 나머지 70초가 5회의 Voyage 임베딩+Upstash upsert 호출 시간이다. 이전 QA의 "4.0초" 기록은 이 구조와 맞지 않아 **신뢰하지 않기로 하고 폐기**한다 — 아마 그 세션은 코퍼스가 훨씬 작았거나 다른 조건이었을 것으로 추정되나 재현하지 않았다.
- **최악 경로(추정, 실행 안 함)**: Voyage 429가 배치마다 발생해 `embed()`(`lib/embeddings.ts`)가 매번 `MAX_RETRIES=3`회 재시도를 전부 소진(각 회 기본 `DEFAULT_RETRY_AFTER_SEC=20`초 대기)하고서야 성공한다고 가정하면, 배치당 +60초 → 5배치 × (실측 배치당 처리시간 ~14초 + 60초) + 배치 간 대기 12초 ≈ **382초(6.4분)**. 이 시나리오는 5개 배치 전부가 연속으로 429를 3회씩 맞아야 성립하는, 사실상 Voyage 쪽 지속 장애 상황이라 실제 발생 가능성은 낮다고 판단했다.
- **Vercel 함수 실행시간 한도** (Vercel 공식 문서, fluid compute 기준 최신값 — Next.js 자체 문서(`node_modules/next/dist/docs/.../maxDuration.md`)는 "기본값은 배포 플랫폼이 정한다"고만 서술하므로 플랜별 숫자는 Vercel 문서에서 확인):

  | 플랜 | 기본값 | 최대값 | 확장 최대값 |
  |---|---|---|---|
  | Hobby | 300초 | 300초 | 지원 안 함 |
  | Pro/Enterprise | 300초 | 800초 | 1800초(베타) |

  즉 **Hobby 플랜은 `maxDuration`을 아무리 크게 선언해도 300초를 넘길 수 없다.** 정상 경로(82초)는 어느 플랜에서도 여유롭지만, 최악 경로 추정치(~382초)는 Hobby의 절대 상한(300초)을 넘는다.

**결정**:
1. `app/api/cron/reindex-spots/route.ts`에 `export const maxDuration = 300`을 명시했다. Hobby 플랜의 절대 상한과 같은 값이라 Hobby에서는 동작을 바꾸지 않지만(이미 fluid compute 기본값이 300초), 의도를 코드에 명시해두면 Vercel 대시보드에서 프로젝트 기본값이 낮게 바뀌는 사고를 막고, 추후 Pro로 옮길 경우 이 숫자(와 위 계산)를 참고해 올릴 수 있다.
2. 배치 크기(`EMBED_BATCH_SIZE=50`)와 배치 간 대기(`BATCH_GAP_MS=3000`)는 **바꾸지 않는다.** 정상 경로가 실측 82초로 300초 대비 3.7배 여유가 있고, 최악 경로는 배치 수를 줄이거나 대기를 줄인다고 해결되는 문제가 아니다(Hobby 상한 자체가 300초라 어떤 조정으로도 못 피하는 시나리오). `MAX_RETRIES`/`DEFAULT_RETRY_AFTER_SEC`(`lib/embeddings.ts`)도 유지한다 — 재시도 횟수를 줄이면 일시적 429에 대한 복원력이 떨어지고, `DEFAULT_RETRY_AFTER_SEC`는 Voyage가 `Retry-After` 헤더를 안 줄 때만 쓰이는 보수적 기본값이라 임의로 낮추면 실제 쿼터 회복 전에 재시도해 오히려 재시도 낭비가 늘 수 있다.
3. **중단 시 부분 upsert는 허용 가능하다고 판단**했다: `reindexSpots`는 배치별로 `index.upsert()`를 즉시 커밋하므로, 타임아웃으로 중단돼도 이미 처리된 배치는 새 임베딩으로 정상 갱신된 상태로 남고 나머지는 "갱신 안 됨(stale이지만 유효)" 상태로 남을 뿐이다. 크론이 매일 KST 03:00에 코퍼스 전체를 처음부터 다시 도는 구조라 다음 실행에서 자연히 재보정된다 — 이미 "완전한 실시간 동기화 대신 주기적 재색인"을 택한 기존 트레이드오프(위 "RAG" 절)의 연장선이라 별도 재시작/체크포인트 로직을 추가하지 않는다.

## 선호 조건 조기 종료 폴백 (2026-07-27 결정·구현, P2 항목 1)

**문제**: `filterByPreferences`(`lib/ai.ts`)는 선호 조건(조용한 환경/콘센트 필수/무장애 접근 가능)을 모두 만족하는 스팟이 5곳 미만이면 조건 전체를 무시하고 원본 전체(`spots`)로 되돌아간다. 그런데 `validateRoute`는 여전히 그 조건들을 엄격하게 검증하므로, 폴백이 발동한 요청은 LangGraph가 `MAX_ATTEMPTS(3)`회 전부 실패할 것이 애초에 확정돼 있었다 — Claude API를 최대 3회 낭비하고서야 `validationNote`("일부 조건을 만족하는 동선을 찾지 못해...")를 노출하는 구조였다.

**실측 (로컬 dev, `GET /api/spots` 실호출, 실제 231곳/숙소 제외 216곳 코퍼스, 2026-07-27)**: `filterByPreferences`를 실제로 호출해(표현식 복사가 아니라 함수 자체를 임시 export해 debug 라우트로 실행) 검증 가능한 3개 조건의 모든 조합(2^3-1=7가지)을 측정했다.

| 조합 | 통과 스팟 수 |
|---|---|
| 조용한 환경 단독 | 214 |
| 콘센트 필수 단독 | 13 |
| 무장애 접근 가능 단독 | 12 |
| 조용한 환경 + 콘센트 필수 | 11 |
| 조용한 환경 + 무장애 접근 가능 | 11 |
| 콘센트 필수 + 무장애 접근 가능 | 8 |
| 3개 전부 | **7** |

같은 측정을 관광공사 API가 전부 실패한 폴백 시나리오(`TOURISM_API_KEY`를 깨진 값으로 강제, `VERIFIED_SPOTS` 24곳 대체 경로 실제 발동 확인)에서도 반복했으나 카카오 카페(관광공사 키와 무관하게 성공)가 코퍼스 대부분을 차지해 결과가 동일했다(3개 전부 조합도 7곳).

**결론**: "조용한 환경" 필터 기준 통일(위 "필터-검증 정합성 결정" 절, 2026-07-27) 덕분에 **현재 실데이터로는 이 폴백이 임계값(5곳) 아래로 떨어지는 조합이 없다** — 가장 빡빡한 3개 조합도 7곳으로 여유가 있다. 다만 여유가 2곳뿐이라, barrierFree/power 실측 데이터가 지금보다 줄어들거나(예: 카카오 카페 목록 변동으로 무장애/콘센트 조건을 만족하는 카페가 몇 곳 빠지는 경우) 코퍼스 구성이 바뀌면 재현 가능한 경로로 남아 있다고 판단해, **경량 방안(조기 종료)을 그대로 구현했다** — 실제로 발동하지 않는 상태라도 구현 비용이 낮고 회귀 위험도 없어, "지금 안 터지니 방치"보다 방어적으로 남겨두는 쪽을 택했다.

**구현** (`lib/ai.ts`):
- `applyPreferenceFilters`: 기존 `filterByPreferences`의 필터링 로직만 분리(폴백 판단 없이 필터만 적용). `filterByPreferences`는 이 함수를 호출한 뒤 기존과 동일하게 `길이 >= MIN_PREFERENCE_MATCHES(5) ? 필터링됨 : 원본`을 반환한다 — **폴백 로직 자체(5곳 기준, 조건 전체 무시)는 그대로 유지**했다(이번 스코프는 "낭비 제거"이지 폴백 정책 자체를 단계적 완화로 바꾸는 것은 비용 대비 효과가 낮다고 판단해 채택 안 함, 아래 "고려했으나 채택 안 함" 참고).
- `curateRoute`: `preFilter` 호출 전에 `applyPreferenceFilters(nonStaySpots, request).length`로 엄격 기준 통과 개수(`strictMatchCount`)를 미리 계산한다. 검증 가능한 선호 조건(`CHECKABLE_PREFERENCES`)이 1개 이상 선택됐고 `strictMatchCount < MIN_PREFERENCE_MATCHES`이면, `curationGraph`(최대 3회 생성+검증 루프)를 아예 타지 않고 `generateOnce`를 **1회만** 호출한 뒤 `validationNote`에 "선택하신 조건(OOO, OOO)을 모두 만족하는 곳이 N곳뿐이라, 조건을 완화한 결과를 보여드립니다"를 채워 반환한다.
- 조기 종료 시에도 `workSpots`(→`preFilter`가 만든 후보, 내부적으로 여전히 `filterByPreferences`의 폴백을 거쳐 원본 전체 후보를 사용)와 `lifeSpots`는 정상 경로와 동일하게 구성한다 — 즉 "몇 곳 안 되지만 조건을 만족하는 후보들"이 여전히 프롬프트에 노출되므로(`buildWorkSpotsContext`가 noise/power/barrierFree를 스팟마다 그대로 보여줌), Claude가 1회 생성에서도 실제로 조건을 만족하는 곳을 고를 가능성이 남아 있다.

**실측 검증 (실제 Claude API 호출, 로컬 dev, 표현식이 아니라 `/api/ai/curate` 엔드포인트를 통해 실제 `curateRoute` 전체 파이프라인 실행)**: 합성 테스트 스팟 7곳(그중 정확히 2곳만 3개 조건 전부 충족, 실측 데이터와 동일한 필드 형태) + 3개 선호 조건 전부 선택으로 호출한 결과:
- 조기 종료 분기가 정확히 발동(`strictMatchCount: 2`)했고, `curationGraph`는 호출되지 않았다(재시도 루프 미진입).
- 실제 Claude 응답 시간 **3.9초**(1회 생성) — 기존 구조라면 최대 3회(3배 이상)가 낭비될 수 있었던 케이스.
- Claude가 실제로 조건 3개를 모두 만족하는 스팟(2곳 중 1곳)을 정확히 선택했고, `validationNote`가 "선택하신 조건(조용한 환경, 콘센트 필수, 무장애 접근 가능)을 모두 만족하는 곳이 2곳뿐이라, 조건을 완화한 결과를 보여드립니다"로 정확히 렌더링됨을 확인했다.
- 회귀 확인: 동일 스팟 세트에 `preferences: []`로 호출하면 조기 종료 분기가 발동하지 않고 `curationGraph` 정상 경로(1회 생성에 검증 통과, `validationNote` 없음)로 흐르는 것도 확인했다. 실제 프로덕션 231곳 코퍼스 + 실제 `/api/life-spots`/`/api/food-spots` 데이터로 "콘센트 필수" 단독(13곳, 폴백 미발동) 조합도 정상 호출해 회귀 없음을 재확인했다(5.5초, `validationNote` 없음).

**고려했으나 채택 안 함 — 조건 단계적 완화**: "5곳 미만이면 조건을 하나씩 제거하며 5곳 이상이 될 때까지 완화"하는 방식도 검토했으나, (1) 현재 실측 데이터로는 폴백 자체가 발동하지 않아 이 복잡도를 정당화할 실증 사례가 없고, (2) 어떤 조건을 먼저 완화할지(마지막 추가 조건부터? 가장 적게 걸러내는 조건 우선?) 결정이 자의적이며 사용자가 명시적으로 선택한 조건 중 일부를 조용히 무시하는 것은 "조건을 완화했다"는 사실을 사용자에게 정확히 알리기가 더 어려워진다(현재 조기 종료 방안은 "어떤 조건 조합이, 몇 곳으로 부족했는지"를 있는 그대로 알림). 경량 방안으로 충분하다고 판단했다.

## 벡터 랭킹 무력화 방지 (2026-07-27 결정·구현, P2 항목 3)

**문제**: `rankCandidates`(`lib/ai.ts`)가 자유 텍스트 요청 시 `queryTopK`(`lib/vector-store.ts`)로 벡터 검색을 시도하는데, `queryTopK`는 미설정/실패 시에만 `null`을 반환하고 **검색 자체는 성공했지만 반환된 id가 현재 요청의 후보(`spots`)와 하나도 안 겹치는 경우**엔 빈 배열 `[]`을 반환한다(`null`이 아님). 이 경우 `ranked`가 빈 배열이 되고 `rest`(원본 순서 그대로)만 반환되는데, `semanticSort` 폴백은 타지 않았다. 그런데 `generateOnce`의 프롬프트는 자유 텍스트가 있으면 항상 "워크스팟 후보 목록은 이 요청과의 관련도가 높은 순서로 정렬되어 있습니다. 반드시 목록 상위 3~5개 안에서 고르세요"라고 지시한다 — 랭킹이 무력화됐는데도 거짓 전제로 상위 선택을 강제하는 상태였다.

**"빈 인덱스" 상태가 실제로 가능한지 확인**: `isVectorStoreConfigured()`(`lib/vector-store.ts`)는 환경변수(`UPSTASH_VECTOR_REST_URL`/`TOKEN`)만 확인하고 인덱스에 벡터가 실제로 있는지는 확인하지 않는다. `reindexSpots`는 Vercel Cron(`/api/cron/reindex-spots`, 매일 KST 03:00)이 호출하므로, **배포 직후부터 첫 크론 실행 전까지는 환경변수가 이미 설정돼 `isVectorStoreConfigured() === true`이지만 인덱스는 완전히 비어 있는 상태가 실존한다** — 신규 배포/신규 Upstash 인덱스 생성 시 흔히 발생하는 경로다. 이 경우 `queryTopK`가 topK개를 요청해도 실제로 매칭되는 벡터가 0개이므로 빈 배열을 반환하고(에러 아님), 정확히 이 버그 경로를 탄다.

**실측 검증 (실제 Upstash Vector 실호출 + 실제 Voyage 임베딩 호출, 로컬 dev)**: 완전히 빈 인덱스를 만들어 재현하는 대신(운영 중인 인덱스를 비우는 것은 위험하다고 판단), id가 실제 인덱스에 절대 존재하지 않는 합성 스팟 3곳(`faketest-*`, 실측 데이터와 동일한 스키마)을 만들어 `rankCandidates`를 실제로 호출했다(함수를 임시 export해 debug 라우트로 실행, 표현식 복사 아님). 결과:
- `queryTopK`가 **실제 운영 인덱스에서 topK 30개의 실제 id를 정상 반환**했지만(`null` 아님), 합성 스팟 3곳의 id와 하나도 안 겹쳐 수정 전 로직이라면 `ranked.length === 0`이 되는 상황이 실제로 재현됐다.
- 수정된 코드는 이 경우 `semanticSort`로 폴백했고, 실제 Voyage 임베딩 유사도 계산 결과 입력 순서를 `[번화가/시끄러움 카페, 사무지구 카페, 조용한 바다뷰 카페]`(가장 관련 있는 스팟을 의도적으로 맨 뒤에 배치)로 줬을 때 출력이 `[조용한 바다뷰 카페, 번화가 카페, 사무지구 카페]`로 **실제 의미 기반 재정렬이 일어남**을 확인했다(자유 텍스트 쿼리: "조용히 바다 보면서 일할 수 있는 곳"). 수정 전 로직이었다면 `ranked=[]`, `rest=spots`(원본 순서 그대로) → 가장 관련 있는 스팟이 계속 맨 뒤에 남아 있었을 것이다(코드 추적으로 확정, 별도 재현 불필요 — `rankedIds`가 빈 Set이면 `rest = spots.filter(() => true)`로 전체가 그대로 남는 것은 로직상 자명함).

**구현** (`lib/ai.ts` `rankCandidates`): `vectorIds`가 `null`이 아니어도 `ranked.length === 0`이면 `semanticSort(freeText, spots)`로 폴백하는 분기 1줄을 추가했다. 프롬프트 지시문("상위 3~5개 안에서 고르라")은 그대로 두었다 — 이 수정으로 자유 텍스트가 있는 모든 경로(벡터 검색 성공+겹침, 벡터 검색 성공+안 겹침→semanticSort, 벡터 미설정/실패→semanticSort)에서 항상 실제 랭킹이 적용되므로, 프롬프트의 전제("정렬되어 있다")가 더 이상 거짓이 되는 경로가 없다.

## 재시도 시 후보 고정 결정 (2026-07-27, P2 항목 2)

**확인**: `generateNode`(`lib/ai.ts`)가 재시도 시에도 `state.workSpots`/`state.lifeSpots`를 그대로 재사용하는지 코드로 확인했다 — `CurationState`의 두 필드는 `curateRoute`가 그래프를 최초 호출할 때(`curationGraph.invoke({..., workSpots, lifeSpots, ...})`)만 채워지고, `generateNode`/`validateNode` 어느 쪽도 이 두 필드를 반환값에 포함하지 않는다(각각 `{ route, attempt }`, `{ valid, reasons }`만 반환). LangGraph의 `Annotation` 상태 병합 규칙상 노드가 반환하지 않은 키는 이전 값이 그대로 유지되므로, **재시도 3회 내내 후보 집합은 완전히 고정된다** — 코드로 재확인 완료.

**결정: 의도된 트레이드오프로 인정, 코드 변경 없음.** 근거:
1. 위 "선호 조건 조기 종료 폴백" 절에서 다룬 시나리오(후보 집합 자체가 문제라 재시도가 필연적으로 전부 실패하는 경우)는 이미 그 조기 종료 분기가 별도로 처리한다 — 즉 "후보 집합 자체의 결함으로 재시도가 의미 없는" 사례는 항목 1의 수정으로 재시도 루프에 도달하기 전에 걸러진다.
2. 재시도 루프에 실제로 도달하는 나머지 실패 사유(예: 이동 거리 초과, 식당 누락, 워크스팟 개수 오류)는 "후보 집합 안에 답이 없다"가 아니라 "같은 후보 집합 안에서 Claude가 다른 조합을 골라야 하는" 문제다 — `preFilter`가 만든 후보(최대 12곳)에는 대개 조건을 만족하는 다른 조합이 남아 있고, `feedback`(실패 사유 텍스트)이 다음 프롬프트에 명시적으로 들어가 Claude가 같은 실수를 반복하지 않도록 유도한다. 이 경우 후보 집합을 바꾸는 것보다 같은 집합 내에서 다른 선택을 유도하는 것이 더 저렴하고 예측 가능하다.
3. 후보 집합을 매 재시도마다 바꾸려면(예: 실패한 워크스팟을 제외하고 다음 후보로 교체) `preFilter`/`rankCandidates`를 재시도 루프 안으로 옮기고 상태에 "제외 목록"을 추가하는 구조 변경이 필요하다 — 복잡도 대비, 현재 재시도가 실제로 실패하는 사례(항목 1 이후 남은 사례)가 "다른 조합 선택"으로 대부분 해결 가능한 문제라 이 비용을 들일 근거가 약하다고 판단했다.

**결론**: "재시도 시 후보는 고정"이 의도된 설계다. 코드 변경 없음.

## 재색인 삭제 미구현 판단 (2026-07-27, P2 항목 4)

**문제**: `reindexSpots`(`lib/vector-store.ts`)가 매번 전체 코퍼스를 upsert만 하고, 코퍼스에서 사라진 스팟의 벡터를 인덱스에서 삭제하지 않는다. `rankCandidates`의 `byId` 대조로 결과 정확성은 지켜지지만(존재하지 않는 id는 `byId.get(id)`가 `undefined`가 되어 걸러짐), stale 벡터가 `topK` 슬롯을 차지해 실질 랭킹 후보 수가 줄어들 수 있다.

**코퍼스 변동성 재확인 (코드 추적)**:
- 관광공사 항목의 id는 `tourism-${contentid}`/`attraction-${contentid}`/`food-${contentid}` 형태(`lib/tourism-mapper.ts`)로, 정부 DB의 `contentid`를 그대로 쓰는 안정적 식별자다. 항목이 통째로 사라지는 경우는 실제 폐업/DB 정리 등 드문 사건이지, 정렬 순서가 바뀌어서 id가 바뀌는 구조가 아니다.
- 카카오 카페 id는 `kakao-${p.id}`(`lib/kakao-local-api.ts`)로 카카오맵의 안정적 장소 id를 그대로 쓴다. 검색은 5개 중심점 × 반경 6km × `size=15` × 3페이지(중심점당 최대 45곳)로, 카카오 카테고리 검색 기본 정렬(거리 기반)은 위경도 고정값 기준이라 매일 실행해도 순서가 요동치지 않는다 — id가 바뀌는 것은 실제 개업/폐업일 때뿐이다(반경 내 카페가 45곳을 넘으면 46번째부터는 매번 동일하게 잘리는 것이지, "이번엔 포함 다음엔 제외"처럼 흔들리는 구조가 아니다).
- 즉 코퍼스 변동은 "매일 다른 스팟이 들어왔다 빠졌다" 하는 게 아니라 "실제 개업/폐업 시에만 드물게 id가 바뀌는" 구조라, 재색인마다 stale 벡터가 쌓이는 속도 자체가 낮다.

**결정: 코드 변경 없음, 삭제 로직 미구현 유지.** 실제 코퍼스 규모(231곳)와 위 변동성 분석을 종합하면, 삭제 로직(예: 이전 색인의 id 목록을 저장해두고 이번 색인과 차집합을 구해 `index.delete()` 호출)을 추가하는 구현·유지보수 비용 대비, stale 벡터가 실제로 쌓이는 속도와 그로 인한 랭킹 품질 저하 효과가 낮다고 판단했다. `topK`가 `Math.max(spots.length, 30)`으로 넉넉하게 설정돼 있어(현재 코퍼스 231곳 기준 231개 요청), stale 벡터 몇 개가 상위 슬롯을 차지해도 `byId` 대조 후 남는 실질 랭킹 후보 수에 미치는 영향은 미미하다.

**재검토가 필요해지는 조건**: 카카오 API 응답 정책이 바뀌거나(예: 정렬 기준을 거리에서 인기도로 변경) 코퍼스 소스가 늘어나 id 체계가 더 유동적인 소스(예: 사용자 제보 기반 목록)로 확장되면, 이 판단을 다시 검토해야 한다.

## 클라이언트→서버 스팟 왕복 검증 (2026-07-28, P3 항목 1)

**문제**: `/api/ai/curate`가 클라이언트가 보낸 `spots`/`lifeSpots` 배열(원래 `/api/spots`, `/api/life-spots`, `/api/food-spots`가 내려준 것을 그대로 왕복시킨 값)을 내용 검증 없이 `curateRoute`에 넘겼다. 존재하지 않는 id 주입, `wifi.available`/`power.level`/`noise`/`barrierFree`/`description` 필드 위조(프롬프트 인젝션 경로 포함)가 가능했다.

**결정: 서버가 클라이언트 제공 값을 신뢰하지 않고, id만 힌트로 쓰고 필드 값은 전량 서버 코퍼스로 치환.** `app/api/ai/curate/route.ts`가 `curateRoute` 호출 전에 `buildSpotCorpus()`(`lib/spot-corpus.ts`, 기존)와 새로 추가한 `buildLifeSpotCorpus()`를 직접 호출해 서버 자체 코퍼스를 만들고, 클라이언트가 보낸 배열의 각 원소를 `id` 기준으로 이 코퍼스에서 다시 조회해 **매칭되는 서버 쪽 객체로 완전히 치환**한다(원본 배열의 다른 필드 값은 전혀 안 쓰임). 코퍼스에 없는 id는 자동으로 걸러진다.

`buildLifeSpotCorpus()`는 `/api/life-spots`(attraction)·`/api/food-spots`(food, `looksLikeCafe` 제외)·`/api/stay-spots`(stay)와 완전히 동일한 조회·필터·매핑 로직을 재사용한다 — 다르게 구현하면 "정상 클라이언트가 실제로 받을 수 있었던 id 집합"과 검증 코퍼스가 어긋나 오탐/누락이 생기기 때문이다.

**트레이드오프**: `/api/ai/curate` 요청마다 `buildSpotCorpus()`(관광공사 3종 API + 무장애 API + 카카오 카페 API + 혼잡도 API)와 `buildLifeSpotCorpus()`(관광공사 3종 API)를 매번 새로 호출한다 — 이미 `/api/spots` 등에서 한 번 계산된 값을 클라이언트가 그대로 들고 왔었는데, 이를 신뢰하지 않기로 한 대가로 큐레이션 요청마다 외부 API 재조회 비용이 추가된다. 응답 지연·API 쿼터 소비가 늘어나는 것은 알고 있는 트레이드오프이며, 보안/데이터 정합성(위조 필드가 판정에 영향을 주지 않아야 한다는 요건)이 우선한다고 판단해 이 방향을 택했다. 캐싱(예: 재색인 크론과 동일 주기로 코퍼스를 짧게 캐시)은 이번 범위 밖이며, 지연이 실제로 문제가 되면 추후 별도 항목으로 다룬다.

## toolUse.input 런타임 검증 (2026-07-28, P3 항목 3)

**문제**: `generateOnce`(`lib/ai.ts`)가 Claude의 `recommend_route` tool_use 응답을 `as` 타입 단언만으로 신뢰했다. `tool_choice` 강제 + `required` 스키마로 발생 확률은 낮지만, 필드가 비어 있으면 재시도 루프 밖(`withDistanceTip`)에서 원인 불명의 `TypeError`가 났다.

**결정**: `isRecommendToolInput` 수동 타입가드(zod 등 새 라이브러리 도입 없이 최소 diff)를 추가해 `generateOnce` 내부에서 명시적 에러로 바꿨다. `stopNotes.length === order.length`까지 확인한다(두 배열을 인덱스로 짝짓는 `noteById` 로직이 있어서, 길이가 어긋나면 조용히 잘못 짝지어질 수 있기 때문).

**이 에러는 `routeAfterValidate`의 상태 기반 재시도 루프를 타지 않는다 — 의도된 선택.** 재시도 루프는 "정상적으로 반환된 route가 검증 기준(`validateRoute`)을 통과하지 못했을 때"만 발동하는 state 기반 메커니즘이고, LangGraph `StateGraph`는 노드에 `retryPolicy`를 별도로 지정하지 않는 한 노드가 던진 예외를 자동으로 재시도하지 않는다(`node_modules/@langchain/langgraph` 확인). `isRecommendToolInput` 실패를 억지로 이 루프에 태우려면 `route: null` 상태를 만들고 `validateNode`/`finalizeRoute`(둘 다 route가 있다고 가정하고 `route.spots`에 바로 접근함) 양쪽에 null 방어 코드를 추가해야 하는데, 스키마 검증 실패는 매우 드문 케이스라 이 복잡도·회귀 리스크를 들일 근거가 약하다고 판단했다. 대신 "정체불명 TypeError"였던 기존 증상을 "원인이 명시된 즉시 실패"로 개선하는 데 그쳤다 — 실패는 `curationGraph.invoke()`를 reject시켜 `route.ts`의 바깥쪽 catch(`curation_failed`, 500)로 바로 간다.

## duration 값 API 계약 (2026-07-28, P3 항목 4)

**결정**: (b) 채택. `app/api/ai/curate/route.ts`의 `isValidCurationRequest`에 `[2, 4, 6, 8].includes(v.duration)` 검증을 추가해, 그 외 값은 `400 invalid_curation_request`로 거부한다. 항목 1에서 어차피 이 라우트의 입력 검증부를 다시 만지게 되어 diff가 작았고, `/api/ai/curate`를 직접 호출하는 제3자/QA 자동화에 계약을 명시적으로 강제하는 편이 "암묵적으로 최근접 버킷에 매핑된다"보다 낫다고 판단했다.

`distanceThresholdFor`(`lib/ai.ts`) 자체의 최근접 버킷 매핑 로직(동점 시 작은 값 우선)은 그대로 남아 있다 — 위 API 계약 검증을 통과한 값(2/4/6/8)은 애초에 버킷과 정확히 일치하므로 매핑 로직이 실질적으로 쓰일 일은 없지만, 함수 자체를 단순화하는 것은 이번 범위 밖이라 손대지 않았다.

## 라이프스팟 후보 확보 — 위치기반 API 병합 (2026-08-05, 옵션 A)

**문제**: 라이프스팟 후보가 `buildLifeSpotCorpus()`의 "강릉 전역 상위 30+30건" 고정이라, 워크스팟이 어디로 정해지든 후보 집합이 항상 같았다. 재추천해도 후보가 그대로이고, 외곽 워크스팟을 고르면 동선이 길어진다. 동시에 `getLocationBasedList`(위치기반 관광정보 `locationBasedList2`)는 `app/api/tourism/route.ts`에서만 참조되는 사실상 데드 코드여서, 기획서 3항의 "활용 API: 위치기반 정보" 서술에 대응하는 사용자 경로가 0이었다.

**결정: 대체가 아니라 병합(union).** 워크스팟 후보(랭킹 상위)의 좌표를 기준으로 위치기반 API를 호출해 얻은 후보를 기존 지역 기반 후보에 id 기준 union한다. 대체를 택하지 않은 이유:

1. **파이프라인 구조상 대체가 불가능.** `app/api/ai/curate/route.ts`는 클라이언트가 보낸 `lifeSpots`의 id를 서버 코퍼스와 대조해 교집합만 채택한다 — 클라이언트가 보낸 목록이 후보의 상한이다. 그래서 서버가 직접 조회한 위치기반 후보를 `curateRoute` 안에서 union하는 경로를 명시적으로 열었다(`options.fetchNearbyLifeSpots` 주입). 추가되는 값의 출처가 클라이언트 입력이 아니라 관광공사 API 응답이므로 "클라이언트 값을 신뢰하지 않는다"(2026-07-28, P3 항목 1) 원칙과 충돌하지 않는다. 클라이언트가 보낸 **필드 값**을 신뢰하는 경로는 추가하지 않았다.
2. **폴백 안전성.** 위치기반 API만 쓰면 호출 실패 시 라이프스팟이 0건이 되고, `validateRoute`의 "식당이 동선에 포함되지 않았습니다" 구조적 위반으로 재시도 3회(약 42초)를 통째로 낭비한다.
3. **커버리지.** 위치기반 API는 반경 내만 반환하므로 워크스팟이 외곽이면 후보가 오히려 줄 수 있다. 지역 기반 30+30건이 하한선 역할을 한다.

**파라미터** (`lib/spot-corpus.ts`의 `buildNearbyLifeSpotCorpus`)

| 항목 | 값 | 근거 |
|---|---|---|
| 기준 좌표 수 `NEARBY_REF_COUNT` | 1 (preFilter 결과 12곳 중 랭킹 1위) | 원래 3(상위 3곳)으로 시작했으나, QA 실측(2026-08-05, n=10 페어링)에서 랭킹 2·3위 반경 후보가 라이프스팟 랭킹 상위권을 밀어내 총 이동거리가 병합 전보다 +151m(2.9%) 유의하게 길어짐을 확인(10/10 동일 방향). 1로 줄이면 병합 전과 거리가 소수점 3자리까지 완전 일치(재검증 완료)하면서 호출 수도 절반으로 줆 — 후보 다양성보다 동선 품질·API 호출 절약을 우선하기로 결정 |
| `contentTypeId` | `12`(관광지), `39`(음식점) 각각 호출 | `TourismApiItem`에 `contenttypeid`가 없어 응답만으로 카테고리 분류 불가. 타입 확장보다 타입별 호출이 최소 변경 |
| 요청당 최대 호출 | 1 × 2 = **2회** (캐시 미스 기준) | refs를 몇 개 넘기든 함수 내부에서 `slice(0, NEARBY_REF_COUNT)`로 상한을 코드로 보장 |
| `radius` | 3000 m | 거리 임계값이 duration별 8~16km이고 구간이 3~4개이므로 구간당 3km 이내가 적정 |
| `numOfRows` | 20 (현행) | 3좌표 × 2타입 × 20 = 최대 120건 |
| 캐시 | `fetchApi`의 `next: { revalidate: 3600 }` + 좌표 **소수점 3자리 반올림** | 워크스팟 좌표는 소수점 10자리라 그대로 쓰면 URL이 매번 달라져 캐시가 한 번도 안 맞는다. 격자화는 `getLocationBasedList` 내부(`toGridCoord`)에서 수행해 호출부마다 어긋나지 않게 함 |

**폴백**: 6회 호출은 `Promise.allSettled`로 감싸 일부 실패해도 성공분만 병합하고, 전부 실패하면 빈 배열 → `extendLifeSpotCandidates`가 지역 기반 후보를 그대로 반환한다. 병합 후 후보에 적용하는 `balanceLifeSpots`(최근접 거리순 + 식당 최소 확보) 로직은 변경하지 않았다.

**비목표**: 위치기반 API로 워크스팟을 추가하지 않는다 — `wifi`/`power`/`noise`가 전부 `null`인 스팟만 늘어나 데이터 규칙상 이득이 없다.

**조용한 실패 로깅**: 공공데이터포털은 트래픽 한도 초과·키 오류 시 HTTP 200에 다른 에러 봉투를 실어 줄 수 있는데, 기존 `extractItems`는 이때 TypeError를 냈고 호출부의 `allSettled`/`try-catch`가 이를 "정상 0건"과 똑같이 빈 배열로 삼켜 흔적이 남지 않았다. `extractItems`가 `data.response?.body` 부재를 감지해 `[tourism-api] unexpected envelope (endpoint=…)`를 `console.error`로 남기도록 했다(폴백 동작·사용자 에러 문구는 그대로).

**실측(2026-08-05, 로컬 dev, 실제 API/Claude 호출, 코퍼스 232곳)**: `/api/ai/curate` 7.4~7.5초(재시도 없이 1회 성공, 관광공사 캐시 워밍 상태) — 기존 실측 12~14초 대비 증가 없음. `maxDuration = 120` 상향 불필요. 위치기반 단건 호출은 캐시 미스 0.30초 / 히트 0.004초이며, 소수점 4자리 이하만 다른 좌표(같은 3자리 격자)도 캐시 히트를 확인했다.

## 검증 결과 노출 (2026-08-05, 옵션 C)

**문제**: `validateRoute`가 코드로 검증을 하는데 결과는 실패 시 `validationNote` 한 줄로만 보였다. 성공 케이스에서 "무엇을 검증해 통과했는지"가 화면에 0건이라, 이 프로젝트의 차별점(할루시네이션을 코드로 잡는 구조)이 코드에만 존재했다.

**결정**: `validateRoute`가 기존 반환 필드(`valid`/`reasons`/`structuralReasons`)를 그대로 둔 채 표시용 `checks: RouteCheck[]`를 함께 반환하고, `finalizeRoute`가 `CurationRoute.verification`(**optional**)을 채운다. 판정은 기존 조건식을 그대로 재사용하며 새 기준을 만들지 않는다 — 검증 로직과 표시가 어긋나면 화면이 거짓말을 하게 된다. LLM에게 되묻지 않는다(AI 규칙 3).

`verification`이 optional인 것은 타협이 아니라 요건이다: `CurationRoute`는 `lib/planner-storage.ts`가 `localStorage`(`wk_plans`)에 직렬화하고 `encodePlan`으로 공유 URL에 싣는다. 필수 필드로 만들면 기존 저장 플랜·공유 링크 렌더링이 깨진다.

**status 판정 규칙**

| check id | pass | fail | skipped |
|---|---|---|---|
| `workspot-count` | 워크스팟 정확히 1곳 | 그 외 | — |
| `food-included` | 식당 1곳 이상 | 미포함 | — |
| `distance` | `distance <= threshold` | 초과 | — |
| `power` | "콘센트 필수" 선택 + 전 워크스팟이 충분함/제한적 | 위반 발생 | 선호 미선택 |
| `barrier-free` | "무장애 접근 가능" 선택 + `exit === true` | 위반 | 선호 미선택 |
| `noise` | "조용한 환경" 선택 + `언급됨-시끄러움` 아님 | 위반 | 선호 미선택 |
| `unverifiable-preference` | — | — | "뷰 좋은 곳"/"카페인 충전 가능" 선택 시에만 항목 추가 |

`skipped`는 화면에서 흐리게(`opacity-60`) 낮춰 통과로 오인되지 않게 한다.

**표기 규칙 (데이터 규칙 1·2·3 준수)**

- `wifi`/`power`/`noise` 문구는 전부 `lib/utils`의 `wifiLabel`/`powerLabel`/`noiseLabel`을 거친다. 새 라벨 함수를 만들지 않는다.
- `null`/`미확인`은 회색 중립 배지(`bg-muted`)이며 절대 `bad`(빨강)가 아니다 — "없음"과 "미확인"은 다르다.
- `noise`는 `조용함 언급`/`시끄러움 언급` 표기를 유지하고, 카드 각주에 "블로그·검색 스니펫 기반 신호"임을 밝힌다. `조용함`/`quiet` 단독 표기 금지.
- `wifi.speedMbps` 관련 문구(Mbps/속도/빠른 WiFi)는 UI에 0건 (데이터 규칙 2).
- `congestion`은 검증 카드에서 **제외**한다 — 실데이터와 `estimateCongestion` 추정치가 섞여 있어(데이터 규칙 5) "검증 통과 항목"에 넣으면 추정치가 사실로 승격된다. 기존 결과 카드의 "예상 OO" 표기는 그대로 둔다.
- 실측 24곳은 `실측 확인`, 그 외는 `API 제공` 배지로만 구분한다(`measured: false`를 "검증됨"으로 오인시키지 않기 위함).

**거리 표기 정정**: `withDistanceTip`의 `실제 총 이동 거리: 약 X km`를 `총 이동 거리: 약 X km (직선 기준)`으로 고쳤다. 같은 화면의 `RouteMap`은 카카오모빌리티 도로 경로를 그리는데 팁은 하버사인 직선 합계를 "실제"라고 불러 두 거리 개념이 뒤섞여 있었다. 이동 시간 반영·도로 거리 교체는 옵션 E 범위이므로 표기만 정정했고, `validateRoute`의 임계값 판정은 하버사인 그대로다(AI 규칙 2).

## 무장애 세부 필드 노출 (2026-08-06, 옵션 I)

**배경**: `WorkSpot.barrierFree`는 `wheelchair`/`elevator`/`restroom`/`parking`/`exit` 5개 필드로 구성되는데, `/spots/[id]` 상세 페이지는 이미 5개 전부를 배지로 보여주는 반면 AI 큐레이터 경로(필터·검증·`RouteVerificationCard`·목록 필터)는 `exit` 파생값(`isBarrierFree()`) 1개만 써 왔다. 이번 라운드는 "검증 게이트를 늘리는 것"이 아니라 **이미 수집된 데이터를 AI 큐레이터 결과 화면에도 정직하게 더 보여주는 것**으로 범위를 좁혔다(옵션 C "성공해도 근거를 보여준다" 원칙의 연장).

**R2 결정 — 왜 `exit`만 pass/fail 게이트로 유지하는가**: `wheelchair` 필드는 관광공사 원본 API에서 "휠체어 이용 가능"이 아니라 "휠체어 **대여** 서비스" 여부다(실제 응답 예: `"대여위치 : 안내 데스크, 휠체어 종류 : 수동 휠체어, 개수 : 1대"` — 접근성 서술이 아니라 대여처 안내문). `wheelchair: true`를 "휠체어 이용자 전용 동선"류 pass 조건으로 쓰면 대여 서비스 존재를 접근성 존재로 둔갑시키는 것이라 채택하지 않았다. 진짜 접근성 신호는 출입구 단차/경사로/자동문을 담는 `exit`이며, 이미 `isBarrierFree()`/`validateRoute`의 유일한 판정 기준이다 — **이번 라운드에서 이 판정 로직 라인은 전혀 바꾸지 않았다** (git diff로 확인 가능). `elevator`/`restroom`/`parking`은 의미가 명확해 오독 위험은 없지만, 새 `CHECKABLE_PREFERENCES` 항목으로 승격하면 "선호 조건 조기 종료 폴백"(위 2026-07-27 절)의 임계값(`MIN_PREFERENCE_MATCHES=5`) 여유가 더 깎일 위험이 있어 이번 라운드에서는 하드 필터로 승격하지 않았다 — 표시(evidence)로만 확장했다.

**구현**: `SpotEvidence`에 optional `barrierFreeDetail?: WorkSpot["barrierFree"]`를 추가하고 `buildEvidence()`가 가공 없이 그대로 싣는다. `RouteVerificationCard`는 `spot.barrierFree ?? ev.barrierFreeDetail`을 `lib/spot-visuals.ts`의 `BARRIER_FREE_FIELDS`(`{ key, label }[]`, `/spots/[id]`와 공유)로 순회해 5개 배지를 그린다. `false`/`undefined`는 `bad`(빨강)가 아니라 취소선+회색(`/spots/[id]`와 동일 원칙) — 편의시설 부재는 위반이 아니라 정보이기 때문이다. `wheelchair` 배지 라벨은 "휠체어 대여"로 고정하고 "접근"/"이용 가능" 등 접근성을 암시하는 문구와 절대 같은 줄에 섞지 않는다.

**R6 — 라벨 중복 정의 방지**: `lib/verified-spots.ts:9`에 기록된 재발 이력(barrierFree 병합 로직을 두 곳에서 각자 구현하다 한쪽만 빠짐, 2026-07-28)과 같은 유형의 사고를 막기 위해, 5개 필드의 `{ key, label }` 배열을 `lib/spot-visuals.ts`의 `BARRIER_FREE_FIELDS`로 뽑아 `/spots/[id]`와 `RouteVerificationCard`가 같은 소스를 참조하게 했다(둘 다 이 상수를 import).

**R3 — `guidesystem`(유도 안내 시스템) 처리**: 타입에는 있었지만 `mapBarrierFreeToWorkSpot`이 파싱하지 않아 죽어 있던 필드. 2026-08-06 관광공사 무장애 API(`KorWithService2`)를 직접 호출해 확인:
- 목록 API(`areaBasedList2`)는 애초에 wheelchair/exit/elevator/restroom/parking/guidesystem 키 자체를 반환하지 않는다(일반 관광정보 스키마와 동일 — 50~100건 표본에서 0건).
- 상세 API(`detailWithTour2`)는 이 필드들을 반환하지만, 강릉시 지역 관광지 400건(페이지 4개, `areaBasedList2`로 얻은 contentId 전수) 전수 조회 결과 **`guidesystem`이 400건 중 0건 비어있지 않았다.** 같은 표본에서 `wheelchair`는 최소 3건 이상 실값이 확인된 것과 대조적이다.
- **결정: (B) 채택 — `BarrierFreeItem.guidesystem` 타입 필드를 제거**했다(`types/index.ts`, 제거 사유 주석 남김). "타입만 있고 실제로는 항상 비어있는 필드"를 남겨두면 규칙 1·2가 경계하는 "수집하는 척하는 필드"와 같은 부류의 위험이라 pm-analyst 권고 기준(응답이 비어 있으면 (B))을 그대로 따랐다.

**R4 — 목록 필터 확장**: `SpotsClient.tsx`에 `elevator`/`restroom`/`parking` 필터 칩을 필드 의미에 1:1 대응하는 정직한 라벨로 추가했다(`무장애`라는 뭉뚱그린 이름 아래 숨기지 않음). 기존 "무장애"(`exit` 기준) 토글은 변경 없음. `wheelchair` 필터 칩은 R2와 같은 이유로 추가하지 않았다.

**부수 발견 — 이번 라운드 범위 밖, 별도 확인 필요**: R3 조사 중 `lib/spot-corpus.ts`의 `buildSpotCorpus`가 부르는 `getBarrierFreeList`(목록 API)에는 애초에 barrierFree 5개 필드 키가 없다는 것을 확인했다(위 R3 첫 항목과 동일 사실). 즉 **AI 큐레이터가 실제로 쓰는 대량 코퍼스에서 `VERIFIED_SPOTS`(24곳) 밖의 스팟은 5개 필드가 사실상 항상 `false`**로 채워지고, 실제 `exit: true` 등 신호는 거의 전부 `VERIFIED_SPOTS`의 수동 실측(24곳 중 16곳이 `exit:true`)에서 나온다. 단건 상세 조회(`getSpotById` → `getBarrierFreeDetail` → `detailWithTour2`)만 이 필드들을 실제로 채운다. 값 자체가 가짜는 아니라서(빈 응답 → `false`는 정당한 매핑) 데이터 규칙 위반은 아니지만, "barrierFree는 실데이터"(CLAUDE.md 규칙 4)라는 문서화된 전제가 대량 코퍼스 경로에서는 사실상 `VERIFIED_SPOTS` 의존으로 크게 제한된다는 뜻이라 `docs/DATA_STATUS.md` "남은 일"에 별도 항목으로 남겼다. 고치려면 `buildSpotCorpus`가 무장애 후보마다 `getBarrierFreeDetail`을 추가 호출하도록 바꿔야 하는데, 이번 옵션 I(표시 확장) 범위를 벗어나는 별도 작업이라 이번 라운드에서는 손대지 않았다.
