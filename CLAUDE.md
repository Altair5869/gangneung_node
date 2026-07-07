@AGENTS.md

# Gangneung Node — 프로젝트 규칙

## 프로젝트 개요

- 서비스명: 강릉 노드 (Gangneung Node)
- 목적: 한국관광공사 OpenAPI 활용 관광데이터 공모전 (2026, 웹·앱 개발 부문) 제출작
- 기획서: `Gangneung_Node_Plan.md` (상위 폴더 `GangneungNode/`에 위치)
- 제출 마감: 1차 심사 서류 9월 21일(월) 16:00

## 기술 스택

- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- 현재 AI: Claude API (`claude-haiku-4-5-20251001`), `lib/ai.ts`의 `curateRoute` 함수
- 도입 예정: Python + FastAPI (AI 마이크로서비스), LangChain, LangGraph, Chroma 또는 pgvector

**주의**: `Gangneung_Node_Plan.md`에는 "LLM (OpenAI/Gemini) 연동"이라고 적혀 있으나 실제 구현은 Claude API다. 기획서 제출 전 이 불일치를 수정해야 한다.

## 데이터 관련 필수 규칙

1. **`WorkSpot.wifi.available`, `WorkSpot.power.available` 필드에 하드코딩 값을 넣지 않는다.** 관광공사 API·카카오 API 응답에는 와이파이/콘센트 정보가 없다. `available` 값을 모르면 반드시 `null`을 사용한다. 이 두 필드는 전화 확인이나 직접 방문으로 사실 확인이 가능하므로 검증 조건에 사용해도 된다.
2. **`WorkSpot.wifi.speedMbps` 필드는 수집하지 않는다.** 전화로 속도(Mbps)를 물어봐도 업체 직원이 답을 모른다. 블로그 리뷰에도 정확한 숫자가 거의 없다. 이 필드는 항상 `null`로 두고, Node 2 검증 조건에서 "빠른 WiFi" 항목 자체를 제외한다.
3. **`WorkSpot.noise` 필드는 확정값이 아니라 신호(signal)로 다룬다.** 소음은 시간대·요일마다 바뀌고 사람마다 기준이 다르므로, 전화로 "조용해요?"라고 물어도 검증이 안 된다. `noise` 필드를 `"언급됨-조용함" | "언급됨-시끄러움" | "언급없음"` 3단계 신호로 관리하고, 네이버 검색 오픈API(블로그)로 채운다. "확정된 사실"인 것처럼 `quiet`/`noisy`로 표기하지 않는다.
4. **`WorkSpot.barrierFree` 필드는 실제 데이터다.** `lib/tourism-mapper.ts`의 `parseBarrierField` 함수가 관광공사 무장애 API의 실제 응답 문자열(`item.wheelchair`, `item.elevator` 등)을 파싱한 결과이므로, 검증 로직에 그대로 사용해도 된다.
5. **`WorkSpot.congestion`은 부분적으로 실제 데이터다.** `getCongestionMap`에서 실데이터가 있으면 사용하고, 없으면 `estimateCongestion`으로 시간대 기반 추정치를 쓴다. UI에 노출할 때 이 둘을 구분하지 않는다.
6. 자세한 필드별 진위 표는 `docs/DATA_STATUS.md` 참고.

## 외부 데이터 수집 규칙

1. **네이버 지도/카카오맵의 리뷰 페이지를 크롤링하지 않는다.** 이용약관 위반 소지가 있고, 공모전 심사 기준의 "공사 OpenAPI 활용 필수" 요건과도 무관한 데이터를 섞는 게 된다.
2. **네이버 검색 오픈API(블로그 검색)는 사용 가능하다.** 단, 발췌문(약 200자)만 제공되므로 "언급됨-있음 / 언급됨-없음 / 언급없음" 3단계로 분류하고, "언급없음"을 "없음"으로 확대 해석하지 않는다. 설계는 `docs/AGENT_DESIGN.md` 참고.
3. 리뷰/설명 텍스트는 관광공사 API의 `overview` 필드 + 워케이션 특화 문장 직접 작성을 조합해서 확보한다 (30~50곳 대상).

## AI 에이전트 설계 규칙

1. `curateRoute`의 결과를 그대로 신뢰하지 않는다. 사용자가 선택한 `preferences`(무장애, 콘센트 등)를 코드로 검증하는 단계가 반드시 있어야 한다.
2. `nearestNeighborSort`(`lib/ai.ts`)는 위경도 차이를 `Math.hypot`으로 계산하므로 실제 km 거리가 아니다. 거리 검증 로직을 짤 때는 하버사인 공식으로 새로 계산한다.
3. 검증은 LLM에게 "이거 괜찮아?"라고 다시 묻는 self-critique 방식이 아니라, 코드로 명시된 조건(불리언/숫자 비교)으로 한다. 자세한 노드 설계는 `docs/AGENT_DESIGN.md` 참고.

## 참고 문서

- `docs/DATA_STATUS.md` — 필드별 실데이터/가짜데이터 구분표
- `docs/AGENT_DESIGN.md` — LangGraph 노드 설계, 검증 조건, 네이버 API 라벨링 설계
- `Gangneung_Node_Plan.md` (상위 폴더) — 공모전 제출용 기획서
