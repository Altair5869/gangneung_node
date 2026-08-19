@AGENTS.md

# Gangneung Node — 프로젝트 규칙

한국관광공사 OpenAPI 활용 관광데이터 공모전(2026, 웹·앱 개발 부문) 제출작. 기획서: `Gangneung_Node_Plan.md`(상위 폴더 `GangneungNode/`). 1차 심사 서류 마감: 9월 21일(월) 16:00.

Python+FastAPI 마이크로서비스 분리, LangChain, Chroma/pgvector는 의도적으로 도입하지 않음 — Next.js 단일 배포 유지가 공모전 마감 리스크 대비 더 합리적이라 판단한 결정. AI 큐레이션(LangGraph 노드 설계, Upstash Vector, Voyage AI 임베딩) 아키텍처 상세는 `docs/AGENT_DESIGN.md` 참고.

## 데이터 필드 — 함정 주의

- `WorkSpot.wifi.available`, `power.level`: 관광공사/카카오 API에 이 정보 자체가 없음. 모르면 `null`, 하드코딩 금지. `power.level`은 `"충분함"|"제한적"|"없음"|null` 3단계(boolean 아님).
- `WorkSpot.wifi.speedMbps`: 절대 수집 안 함, 항상 `null` (전화·블로그 어디서도 정확한 숫자를 못 구함).
- `WorkSpot.noise`: 확정 사실이 아니라 신호. `"언급됨-조용함"|"언급됨-시끄러움"|"언급없음"` 3단계로만 관리, `quiet`/`noisy` 같은 확정 표기 금지.
- `WorkSpot.barrierFree`: 이건 실제 데이터 (`lib/tourism-mapper.ts`의 `parseBarrierField`가 관광공사 API 응답을 파싱). 검증 로직에 그대로 사용 가능.
- `WorkSpot.congestion`: 실데이터+추정치 혼합(`getCongestionMap`/`estimateCongestion`). UI에서 구분 안 함.
- 필드별 진위 전체 표: `docs/DATA_STATUS.md`

## 외부 데이터 수집

- 네이버 지도/카카오맵 리뷰 페이지 크롤링 금지 (약관 위반 + 공사 API 활용 요건과 무관한 데이터 혼입).
- 네이버 검색 오픈API(블로그)는 사용 가능하나, "언급없음"을 "없음"으로 확대 해석하지 않는다.

## AI 에이전트 검증 원칙

- `curateRoute` 결과를 그대로 신뢰하지 않는다 — `preferences`(무장애, 콘센트 등)는 반드시 코드로 검증한다.
- 방문 순서(`order`)는 LLM 반환값을 그대로 쓰고, 거리는 `calculateHaversineDistance`(`lib/ai.ts`)로 순차 검증만 한다 (재정렬하지 않음).
- 검증은 LLM에게 다시 묻는 self-critique가 아니라 코드 조건(불리언/숫자 비교)으로 한다. 노드 설계 상세: `docs/AGENT_DESIGN.md`

## 하네스

기능 개발/버그 수정/PRD 분석/QA 요청 시 `gangneung-node-team` 스킬 사용. 단순 질문은 직접 응답.
