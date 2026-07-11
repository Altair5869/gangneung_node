# 데이터 진위 확인표

`WorkSpot` 타입(`types/index.ts`)의 각 필드가 실제 API 데이터인지, 추정/하드코딩 값인지 정리한 문서. 2026-07-11 코드 기준으로 확인함. 코드가 바뀌면 이 표도 같이 업데이트한다.

## 필드별 표

| 필드 | 상태 | 근거 코드 | 비고 |
|---|---|---|---|
| `wifi.available` | **실측 24곳은 진짜**, 나머지는 `null`(미확인) | `lib/verified-spots.ts`(`VERIFIED_SPOTS`)가 `app/api/spots/route.ts`·`app/api/spots/[id]/route.ts`에서 `tourismContentId` 일치 시 override. 관광공사/카카오 API 매핑 함수(`mapTourismToWorkSpot`, `getKakaoCafes`)는 항상 `{ available: null }`로 초기화 | 24곳은 웹 스크리닝(공식 채널·예약 플랫폼 시설정보) + 전화/방문 사용자 확인으로 채움. `wifi.communitySignal` 같은 별도 신호 필드는 만들지 않았음 — `available`에 사실 기반 값을 직접 기록 |
| `wifi.speedMbps` | 가짜 (하드코딩), **수집 자체를 포기** | 위와 동일 | 전화로 물어봐도 업체 직원이 답을 모름. 블로그 리뷰에도 정확한 숫자가 거의 없음. 항상 `undefined`/`null`, 검증 조건(`lib/ai.ts`)에서도 제외 |
| `power.level` | **실측 24곳은 진짜**, 나머지는 `null`(미확인) | `types/index.ts`: `power: { level: "충분함" \| "제한적" \| "없음" \| null }`. 24곳은 `lib/verified-spots.ts`로 override, 그 외는 `mapTourismToWorkSpot`/`getKakaoCafes`가 `{ level: null }`로 초기화 | 2026-07-11에 `power.available: boolean\|null` + `outlets?: number`에서 3단계 신호로 재설계함 (카페 18곳 실측 결과 있다/없다로 안 갈리고 넉넉함/적음/없음 스펙트럼이 확인됨). `outlets`(콘센트 개수) 필드는 완전히 삭제 — 방문 때마다 바뀌어서 수집 대상 아님 |
| `noise` | **실측 24곳은 웹 스크리닝 신호**, 나머지는 키워드 추정 | `lib/tourism-mapper.ts`/`lib/kakao-local-api.ts`의 `inferNoise`: 제목 키워드 매칭만 함 (도서관→조용함, 브루어리/펍→시끄러움, 그 외 언급없음). 해시 기반 의사난수 로직은 제거됨 | 24곳은 WebSearch로 블로그/다이닝코드/부킹닷컴 등 검색엔진 노출 스니펫만 근거로 "언급됨-조용함/언급됨-시끄러움/언급없음" 3단계로 분류 (지도 리뷰 페이지 직접 크롤링은 안 함, 아래 금지 사항 참고). 네이버 검색 오픈API를 쓰는 대신 WebSearch 도구로 대체 진행함 — `docs/AGENT_DESIGN.md`의 원래 계획과 다름, 아래 갱신 참고 |
| `barrierFree.*` | 진짜 | `lib/tourism-mapper.ts` `mapBarrierFreeToWorkSpot`, `parseBarrierField`: 관광공사 무장애 API 응답 문자열(`item.wheelchair`, `item.elevator`, `item.restroom`, `item.parking`, `item.exit`)을 파싱 | 검증 로직에 그대로 사용 가능 |
| `congestion` | 부분적으로 진짜 | `app/api/spots/route.ts`: `getCongestionMap`에서 실데이터 우선, 없으면 `estimateCongestion(s.id)`로 시간대 기반 추정 | UI에서 실데이터/추정치 구분 안 함 |
| `MOCK_SPOTS` 6곳 전체 필드 | 진짜지만 API 아님 | `lib/spots-data.ts` | 개발자가 직접 조사해서 손으로 입력. 관광공사 API 응답이 아예 없거나(`catch` 분기) 지역 목록이 비었을 때만 fallback으로 쓰임 |
| **`VERIFIED_SPOTS` 24곳 (신규)** | **진짜** | `lib/verified-spots.ts` ← `scripts/data/verified_spots.json` ← `scripts/build_verified_spots.py`가 `spots_enriched.csv`/`selected_library.csv`(wifi/power/noise 실측)를 `candidates_*.csv`(mapx/mapy)와 contentid로 조인해서 생성 | 카페 18 + 호텔 5 + 도서관 1 = 24곳. `app/api/spots/route.ts`·`app/api/spots/[id]/route.ts`가 관광공사/카카오 실시간 응답에 이 값을 override 병합. 원본 CSV가 바뀌면 `python scripts/build_verified_spots.py --data-dir data --out data/verified_spots.json` 재실행 필요 |
| `tourismContentId` | 진짜 | 관광공사 API의 `contentid` 그대로 사용. 도서관은 카카오 로컬 API id(`kakao-8171189`) | |
| `lat`, `lng` | 진짜 | API의 `mapx`, `mapy` 파싱. 파싱 실패 시 `37.751`, `128.876`(강릉 시내 중심 좌표)로 대체 | 좌표 파싱 실패 케이스가 있으면 강릉 시내 중심으로 잘못 표시됨. `VERIFIED_SPOTS`는 `candidates_*.csv`에서 가져온 값이라 이 문제 없음 |

## 히스토리 — 예전에 왜 문제였는지 (해결됨)

`SpotFilter.tsx`의 "빠른 WiFi", "콘센트" 필터 토글이 `wifi.available === true`, `power.available === true`를 기준으로 작동했는데, 관광공사/카카오 API로 들어온 스팟은 전부 `true`로 고정돼 있어서 필터가 사실상 아무것도 걸러내지 못했다. → `null` 도입 + 실측 24곳 채움으로 해결. 다만 24곳 이외의 스팟(관광공사/카카오에서 실시간으로 더 들어오는 것들)은 여전히 wifi/power가 `null`이라 필터를 걸면 대부분 빠진다 — 이건 하드코딩 버그가 아니라 "미확인 데이터는 필터에서 제외한다"는 의도된 동작.

## 완료된 조치 (2026-07 진행분)

1. ~~`wifi.available`, `power.available` 타입을 `boolean`에서 `boolean | null`로 변경~~ 완료 (2026-07-05~06)
2. ~~`wifi.speedMbps`, `power.outlets` 필드는 수집 대상에서 제외~~ 완료. `power.outlets`는 필드 자체를 삭제함 (2026-07-11)
3. ~~`noise` 타입을 3단계 신호로 변경~~ 완료 (2026-07-07)
4. ~~`mapTourismToWorkSpot`, `getKakaoCafes`에서 하드코딩 값 제거, `null`로 초기화~~ 완료
5. ~~UI: `null`이면 "정보 미확인" 회색 배지, 필터는 실측값만 통과~~ 완료
6. ~~30곳 대상 실사 + noise 신호 확보~~ 완료 — 실제로는 워케이션 부적합/미확인 6곳을 제외해 최종 **24곳**. wifi/power는 웹 스크리닝+전화/방문 확인, noise는 WebSearch 웹 스크리닝으로 채움 (2026-07-11, `docs/AGENT_DESIGN.md`의 네이버 API 계획 대신 WebSearch로 대체)
7. ~~`inferNoise`의 해시 기반 추정 로직 제거~~ 완료
8. **(신규)** CSV 실측 데이터를 앱에 실제로 연결 — `VERIFIED_SPOTS` override 메커니즘 구축 (2026-07-11)

## 남은 일

- `power.level`/`noise`가 `null`/`"언급없음"`인 나머지 스팟(관광공사·카카오 실시간 목록, 24곳 밖)은 여전히 미확인 상태 — 필요하면 추가로 실사 범위를 넓힐 수 있음
- `docs/AGENT_DESIGN.md`의 "콘센트 필수" 검증 조건, 네이버 API 관련 서술 갱신 (별도 갱신함, 이 문서와 같이 확인)
