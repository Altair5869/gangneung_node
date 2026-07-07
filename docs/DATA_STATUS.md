# 데이터 진위 확인표

`WorkSpot` 타입(`types/index.ts`)의 각 필드가 실제 API 데이터인지, 추정/하드코딩 값인지 정리한 문서. 2026-07-03 코드 기준으로 확인함. 코드가 바뀌면 이 표도 같이 업데이트한다.

## 필드별 표

| 필드 | 상태 | 근거 코드 | 비고 |
|---|---|---|---|
| `wifi.available` | 가짜 (하드코딩) → 검증 가능한 필드로 교체 예정 | `lib/tourism-mapper.ts` `mapTourismToWorkSpot`: `wifi: { available: true, speedMbps: 50 }` | 전화 확인/직접 방문으로 사실 확인 가능. `null`(미확인) 도입 후 30곳 실사로 채움 |
| `wifi.speedMbps` | 가짜 (하드코딩), **수집 자체를 포기** | 위와 동일 | 전화로 물어봐도 업체 직원이 답을 모름. 블로그 리뷰에도 정확한 숫자가 거의 없음. 항상 `null` 고정, 검증 조건에서 제외 |
| `power.available` | 가짜 (하드코딩) → 검증 가능한 필드로 교체 예정 | `mapTourismToWorkSpot`: `power: { available: true, outlets: 4 }` | wifi.available과 동일한 방식으로 처리 |
| `power.outlets` | 가짜 (하드코딩), 개수까지는 수집 안 함 | 위와 동일 | 콘센트 "있음/없음"은 확인 가능하지만 "몇 개"는 방문 때마다 바뀌므로 수집 안 함. `null` 고정 |
| `noise` | 가짜 (의사난수) → **확정값이 아니라 신호(signal)로 교체** | `lib/tourism-mapper.ts` `inferNoise`: 키워드 매칭 실패 시 `hashCode(contentId) % 10`으로 결정 | 소음은 시간대·요일마다 바뀌고 사람마다 기준이 달라서 전화로도 검증 불가능. `"언급됨-조용함" \| "언급됨-시끄러움" \| "언급없음"` 3단계 신호로 관리, 네이버 검색 API로 채움 |
| `barrierFree.*` | 진짜 | `lib/tourism-mapper.ts` `mapBarrierFreeToWorkSpot`, `parseBarrierField`: 관광공사 무장애 API 응답 문자열(`item.wheelchair`, `item.elevator`, `item.restroom`, `item.parking`, `item.exit`)을 파싱 | 검증 로직에 그대로 사용 가능 |
| `congestion` | 부분적으로 진짜 | `app/api/spots/route.ts`: `getCongestionMap`에서 실데이터 우선, 없으면 `estimateCongestion(s.id)`로 시간대 기반 추정 | UI에서 실데이터/추정치 구분 안 함 |
| `MOCK_SPOTS` 6곳 전체 필드 | 진짜지만 API 아님 | `lib/spots-data.ts` | 개발자가 직접 조사해서 손으로 입력. API 응답이 없을 때 fallback으로 사용됨 |
| `tourismContentId` | 진짜 | 관광공사 API의 `contentid` 그대로 사용 | |
| `lat`, `lng` | 진짜 | API의 `mapx`, `mapy` 파싱. 파싱 실패 시 `37.751`, `128.876`(강릉 시내 중심 좌표)로 대체 | 좌표 파싱 실패 케이스가 있으면 강릉 시내 중심으로 잘못 표시됨 |

## 이게 왜 문제였는지

`SpotFilter.tsx`의 "빠른 WiFi", "콘센트" 필터 토글이 `wifi.available === true`, `power.available === true`를 기준으로 작동하는데, 관광공사/카카오 API로 들어온 스팟은 전부 `true`로 고정돼 있어서 이 필터가 사실상 아무것도 걸러내지 못한다. 실제로 와이파이가 없는 곳도 필터를 통과한다.

## 조치 방향

1. `WorkSpot.wifi.available`, `WorkSpot.power.available` 타입을 `boolean`에서 `boolean | null`로 변경
2. `WorkSpot.wifi.speedMbps`, `WorkSpot.power.outlets` 필드는 타입에서 제거하거나 항상 `null` 고정. 수집 대상 아님
3. `WorkSpot.noise` 타입을 `"quiet" | "moderate" | "noisy"`에서 `"언급됨-조용함" | "언급됨-시끄러움" | "언급없음"`으로 변경
4. `mapTourismToWorkSpot`, `getKakaoCafes`에서 하드코딩 값 제거, `null`로 초기화
5. UI: `null`이면 "정보 미확인" 회색 배지, 필터는 `true`인 것만 통과. `noise`는 "커뮤니티 후기 기준"이라고 명시
6. 30곳 대상으로 `wifi.available`, `power.available`은 전화 확인/직접 조사로 값 채우기, `noise`는 네이버 검색 오픈API 커뮤니티 시그널로 채우기 (`docs/AGENT_DESIGN.md` 참고)
7. `inferNoise`의 해시 기반 추정 로직 제거
