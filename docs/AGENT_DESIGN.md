# AI 에이전트 설계

`curateRoute`(`lib/ai.ts`)를 단일 프롬프트 호출에서 2노드 LangGraph 워크플로우로 바꾸는 설계. 4노드가 아니라 2노드로 좁힌 이유: 스팟 규모가 30~50곳 수준이라 노드를 늘리면 레이턴시만 늘고 검증 기준이 불명확해짐.

## 왜 필요한가 (LLM 호출을 늘리는 게 아니라 코드 검증을 추가하는 이유)

지금 `curateRoute`는 `preferences`(무장애, 콘센트 등)를 지켰는지 확인하는 코드가 없다. Claude가 조건에 안 맞는 스팟을 골라도 그대로 사용자에게 나간다. 또한 `nearestNeighborSort`는 `Math.hypot(lat 차이, lng 차이)`로 거리를 계산하는데, 이건 실제 km가 아니라 위경도 차이를 그냥 유클리드 거리로 계산한 값이다. 이 두 결함을 코드로 검증하는 게 목적이다.

## 노드 구조

**Node 1 — 생성**
지금의 `curateRoute` 로직 (RAG 검색 붙인 버전). 입력: `CurationRequest` + 검색된 후보 스팟. 출력: `CurationRoute`.

**Node 2 — 검증 (코드 기반, LLM 재호출 아님)**
아래 조건을 코드로 체크한다. 하나라도 실패하면 실패 이유를 프롬프트에 追가해서 Node 1을 재호출한다.

## preferences ↔ 필드 매핑

`PREFERENCE_OPTIONS`(`app/ai-curator/page.tsx`) 6개 중 검증 가능한 4개만 검증 대상으로 한다.

| preference 값 | 검증 여부 | 조건 | 비고 |
|---|---|---|---|
| "조용한 환경" | 검증함 (신호 기반) | `noise === "언급됨-조용함"` | 확정된 사실이 아니라 웹 스크리닝(블로그/후기 검색엔진 스니펫) 커뮤니티 신호. `noise === "언급없음"`인 스팟은 이 조건을 건너뜀 (통과도 실패도 아님). UI에 "조용함 언급"이라고 표시해 확정 사실처럼 보이지 않게 함 |
| "빠른 WiFi" | **검증 안 함, 조건 자체 삭제** | — | wifi 속도(Mbps)는 전화로도 블로그로도 확인 불가능. 이 조건을 만들면 안 되는 데이터에 임계값을 거는 것이 됨. `lib/ai.ts`에 이 조건 자체가 없음 (구현 완료) |
| "콘센트 필수" | 검증함 (사실 기반) | `power.level === "충분함" \|\| power.level === "제한적"` | 전화 확인/방문/웹 스크리닝으로 채운 값. `power.level`이 2026-07-11에 `available: boolean` → 3단계 신호(`"충분함"\|"제한적"\|"없음"\|null`)로 바뀌면서 조건도 같이 바뀜. `null`인 스팟은 건너뜀. `lib/ai.ts` `preFilter`에 구현 완료 |
| "무장애 접근 가능" | 검증함 (사실 기반) | `barrierFree !== undefined` | 실데이터이므로 엄격하게 검증 |
| "뷰 좋은 곳" | 검증 안 함 | — | 구조화 필드 없음, `tags` 매칭은 스팟마다 태그가 일관되지 않아 랜덤 통과/실패가 됨 |
| "카페인 충전 가능" | 검증 안 함 | — | 위와 동일 |

**검증 조건 두 종류를 구분한다.** "콘센트 필수", "무장애 접근 가능"은 사실 기반(fact-based) — 전화로 확인되는 예/아니오다. "조용한 환경"은 신호 기반(signal-based) — 커뮤니티 후기에 그런 언급이 있었는지일 뿐, 그 시각 그 장소가 실제로 조용한지 보장 안 한다. 이 둘을 UI에서 같은 방식으로("무장애 접근 가능" 배지처럼) 표시하면 안 된다.

**미확정 항목**: `wifi.speedMbps` 임계값 논의는 폐기함. 이제 논의할 필요 없음.

## 거리 검증 (구현 완료, 2026-07-14)

1. `nearestNeighborSort`가 쓰는 `Math.hypot` 계산은 이미 하버사인 공식(`calculateHaversineDistance`)으로 교체됨.
2. `duration`(2/4/6/8시간)별 총 이동거리 임계값을 순차 합 방식으로 검증한다 (`lib/ai.ts` `totalSequentialDistance`). 순차 합을 택한 이유: `nearestNeighborSort`가 만든 실제 방문 순서 그대로 사용자가 이동할 거리를 반영하는 게 "하루 동선" 개념과 가장 잘 맞음 (반경 방식은 방문 순서와 무관한 면적 지표라 실제 이동 부담을 안 나타냄).

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

- 최대 재시도 횟수: 2회 (제안, 미확정 — 무한 루프 방지 + Claude API 비용 고려)
- 재시도 시 실패 이유(예: "무장애 조건 위반: 스팟 X")를 다음 프롬프트에 명시적으로 넣는다. 이유 없이 같은 프롬프트로 재호출하면 같은 결과가 나올 확률이 높다.
- 2회 다 실패하면: 에러를 던지지 않고 "일부 조건을 만족하는 동선을 찾지 못해 근접한 결과를 보여드립니다"라는 안내와 함께 마지막 결과를 반환한다 (제안, 미확정).

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

## 미확정 항목 정리 (구현 전 확정 필요)

1. duration별 거리 임계값 4개 숫자
2. 거리 계산: 순차 합 vs 반경
3. 재시도 실패 시 동작: fallback 문구 vs 에러
4. ~~wifi 커뮤니티 신호(네이버 API) vs 직접 조사만 사용 최종 선택~~ **확정됨 (2026-07-11)**: 직접 조사(웹 스크리닝 + 전화/방문 확인)만 사용. `wifi.communitySignal` 필드는 만들지 않음. noise도 네이버 API 대신 WebSearch로 대체 진행 — 위 "wifi/power/noise 실측 확보" 절 참고

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
