# /map 페이지 리디자인 설계 (2026-08-03)

## 배경 및 목적

홈페이지·스팟·AI 큐레이터 리디자인(2026-07-29~30)에서 만든 컬러 토큰·다크모드 시스템을 남은 우선순위 페이지 `/map`에 적용한다. 기획서 MVP 3순위 페이지.

현재 `components/map/KakaoMap.tsx`, `components/map/MapSpotCard.tsx`는 `bg-white`/`text-gray-400`/`bg-blue-600`/`bg-purple-600`/`bg-red-50` 등 하드코딩 Tailwind 팔레트를 쓰고 다크모드 지원이 전혀 없다. `MapSpotCard.tsx`는 `lib/spot-visuals.ts`에 이미 있는 `categoryLabel`/`noiseBadge`/`powerBadge`/`congestionStyle`를 재사용하지 않고 로컬에 중복 정의하고 있다.

`app/map/page.tsx`, `app/map/loading.tsx`는 2026-08-01 백지화면 지연 수정(`10d8c57`) 때 이미 토큰 클래스(`bg-background`/`bg-muted`/`border-border`)로 작성되어 있어 이번 라운드 대상에서 제외한다.

## 범위

**포함:**
- `components/map/KakaoMap.tsx` — 필터 패널, 로딩/에러 오버레이(카카오 SDK 초기화 단계) 리스킨 + 다크모드. 색상/토큰 교체만, 레이아웃(위치·구조) 변경 없음.
- `components/map/MapSpotCard.tsx` — 카드 리스킨 + 다크모드, `lib/spot-visuals.ts` 재사용으로 중복 정의 제거.

**제외:**
- 레이아웃/구조 변경, 신규 기능. 필터 패널 위치(지도 좌상단 고정 카드), 바텀시트 위치·구조는 그대로 유지.
- `components/spots/SpotFilter.tsx` — 같은 토글 버튼 하드코딩 패턴(`bg-gray-900`/`bg-blue-600`/`bg-purple-600`/`bg-teal-600`)이 남아있음을 이번 라운드에서 발견했으나, 사용자 결정으로 범위 밖. `/planner`, `/food`, `/stay`, `/events` 리디자인 시 함께 처리 후보로 남겨둠.
- 혼잡도 마커 색(`CONGESTION_COLOR`)과 필터 패널 내 혼잡도 범례 dot — 아래 "예외" 절 참고, 토큰화하지 않음.
- 카카오맵 타일 자체의 다크모드 대응 — SDK가 다크 타일을 지원하지 않아 범위 밖(AI 큐레이터 라운드와 동일 결정).

## 컬러 토큰 매핑 — KakaoMap.tsx

| 현재 (하드코딩) | 교체 후 (토큰) | 비고 |
|---|---|---|
| 로딩 오버레이 `bg-gray-100`/`text-gray-500` | `bg-muted`/`text-foreground/60` | |
| 에러 오버레이 `bg-red-50` | `bg-bad/10` | 오버레이 전체 배경이라 `bg-background` 위 전제 조건 없음 — 화면 전체 덮는 solid-ish 톤이므로 `/10` 저농도로 충분한 대비 확보(아래 검증 계획에서 실측) |
| 에러 카드 `bg-white border-red-100` | `bg-background border-bad/30` | |
| 에러 타이틀 `text-red-600` | `text-bad` | |
| 에러 본문 `text-red-500` | `text-bad` | 기존에도 타이틀과 톤 구분 미미해서 두 단계로 안 나눔 |
| 안내문 `text-gray-400` | `text-foreground/60` | |
| 필터 패널 컨테이너 `bg-white border-gray-100` | `bg-background border-border` | |
| 필터 패널 라벨 `text-gray-700`/`text-gray-400` | `text-foreground`/`text-foreground/60` | |
| 소음 필터 토글 OFF `bg-white text-gray-600 border-gray-200` | `bg-background text-foreground/70 border-border` | |
| 소음 필터 토글 ON `bg-gray-900 text-white border-gray-900` | `bg-primary text-on-primary border-primary` | |
| WiFi 토글 ON `bg-blue-600 text-white border-blue-600` | `bg-primary text-on-primary border-primary` | |
| 콘센트 토글 ON `bg-purple-600 text-white border-purple-600` | `bg-accent text-on-accent border-accent` | |
| WiFi/콘센트 토글 OFF `bg-white text-gray-600 border-gray-200` | `bg-background text-foreground/70 border-border` | |
| 혼잡도 섹션 구분선 `border-gray-100` | `border-border` | |
| 혼잡도 범례 라벨 `text-gray-500` | `text-foreground/70` | |

**예외 — 혼잡도 마커 색·범례 dot는 토큰화하지 않는다.** 마커는 카카오맵 캔버스 내부에 렌더되어 CSS 커스텀 프로퍼티가 적용되지 않고 항상 고정 hex로 그려진다(`RouteMap.tsx` 라운드에서 이미 확인된 제약). 범례 dot를 토큰화하면 다크모드에서 범례 색과 실제 마커 색이 어긋난다. `CONGESTION_COLOR` 상수(`#22c55e`/`#f59e0b`/`#ef4444`/`#6b7280`)와 범례 dot의 `bg-green-400`/`bg-yellow-400`/`bg-red-400`/`bg-gray-400`는 현재 상태 그대로 유지한다.

## 컬러 토큰 매핑 — MapSpotCard.tsx

| 현재 (하드코딩) | 교체 후 (토큰) | 비고 |
|---|---|---|
| 로컬 `categoryLabel`/`noiseBadge`/`powerBadge`/`congestionDot` 정의 | 삭제 → `lib/spot-visuals.ts`의 `categoryLabel`/`noiseBadge`/`powerBadge`/`congestionStyle` import | `powerBadge`는 lib 쪽이 `"없음"` 케이스까지 3단계지만, 렌더 조건(`충분함`\|`제한적`만 배지 표시)은 기존 그대로 유지 — 없음은 배지 자체를 안 띄우는 현재 동작 보존 |
| 카드 컨테이너 `bg-white border-gray-100` | `bg-background border-border` | `SpotCard.tsx`와 동일 패턴, opaque 배경이라 반투명 배지(`bg-{token}/15`) 안전 |
| 카테고리 라벨 `text-gray-400` | `text-foreground/60` | |
| 혼잡도 텍스트 `text-gray-500` | `text-foreground/70` | |
| 스팟명 `text-gray-900` | `text-foreground` | |
| 주소 `text-gray-400` | `text-foreground/60` | |
| 닫기(✕) 버튼 `text-gray-400 hover:text-gray-700` | `text-foreground/50 hover:text-foreground` | |
| 배지 없음 처리(`noise === "언급없음"`) `bg-gray-100 text-gray-400` | `bg-muted text-foreground/50` | |
| WiFi 배지 `bg-blue-100 text-blue-700` | `bg-primary/15 text-primary` | `spot-visuals.ts`에 대응 상수 없어 신규 조합 — `bg-background` 위 렌더 확정이라 스팟 라운드 검증 패턴과 동일 전제 |
| 영업시간 `text-gray-400` | `text-foreground/60` | |
| 하단 구분선 `border-gray-100` | `border-border` | |
| 닫기 버튼(하단) `text-gray-500 hover:bg-gray-50` | `text-foreground/70 hover:bg-muted` | |
| "자세히 보기" CTA `text-blue-600 hover:bg-blue-50` | `text-primary hover:bg-primary/10` | `SpotsClient.tsx` reset 버튼과 동일 패턴 |
| CTA 좌측 구분선 `border-gray-100` | `border-border` | |

## 다크모드

기존 세 라운드와 동일 메커니즘(CSS 커스텀 프로퍼티 스왑, `.dark` 클래스 토글, `dark:` variant 불필요) — 위 토큰 교체만으로 자동 적용. 별도 인프라 작업 없음.

## 테스트 / 검증 계획

- `npx tsc --noEmit`, 대상 파일 `eslint`
- `npm run build`
- `next dev`로 라이트/다크 각각 렌더 확인: 필터 패널(소음/WiFi/콘센트 토글 ON·OFF), 로딩 오버레이(스크립트 로드 전 순간), 에러 오버레이(카카오 키 임시 무효화 등으로 강제 재현), 마커 클릭 → `MapSpotCard` 표시(배지 있음/없음 케이스, WiFi 있음/없음, 콘센트 충분함/제한적/없음), 카드 닫기, "자세히 보기" 이동
- 신규 조합(`bg-bad/10`, `bg-primary/15 text-primary`)은 스팟/AI큐레이터 라운드에서 검증된 `bg-{token}/15` on `bg-background` 패턴 재사용이지만, 에러 오버레이는 `bg-background` 위가 아니라 화면 전체 덮는 배경이므로 대비를 별도 실측
- `lib/spot-visuals.ts` 헬퍼 import 후 로컬 중복 정의 삭제가 회귀를 일으키지 않는지(카테고리 라벨/배지 렌더링 결과가 리스킨 전후 동일한지) 확인
- 혼잡도 마커 실제 색(캔버스 내부)과 필터 패널 범례 dot 색이 라이트/다크 모드 둘 다에서 일치하는지 육안 확인
