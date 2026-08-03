# /food, /stay, /events 페이지 리디자인 설계 (2026-08-03)

## 배경 및 목적

홈페이지·스팟·AI 큐레이터·`/map`·`/planner` 리디자인에서 만든 컬러 토큰·다크모드 시스템을 `/food`, `/stay`, `/events`(맛집/숙박/행사 정보, 한국관광공사 OpenAPI 기반)에 적용한다. 5개 라운드 만에 컬러 토큰 리스킨을 사실상 완결한 이후 남은 마지막 페이지 묶음.

세 페이지는 구조가 거의 동일한 템플릿 반복이다(목록 그리드 + 카드, `/food`·`/stay`만 상세 페이지 있음, `/events`는 목록만). 다만 지금 각 섹션이 서로 다른 브랜드색을 쓴다는 점이 이전 라운드와 다르다 — food(주황/호박), stay(인디고/보라), events(로즈/푸시아). 이 구분은 실제 UX 기능(네비게이션에서 어느 카테고리인지 한눈에 구분)이라 유지하기로 결정했다: 섹션별 색상이 들어가는 요소(히어로 그라디언트, 카드 hover 테두리, 빈 이미지 플레이스홀더, 배지)는 **모드 불변 고정 hex**로 유지하고, 카드/본문의 구조적 chrome(배경·테두리·텍스트)만 토큰화해서 다크모드를 지원한다. 이 처리는 히어로 배너에 `primary-dark`+`hero-glow`를 모드 불변으로 쓰는 기존 패턴과 동일한 원칙이다.

## 범위

**포함:**
- `app/food/page.tsx` — 히어로, 카드 그리드, 빈 이미지 플레이스홀더, 하단 안내문
- `app/food/[id]/page.tsx` — 히어로 이미지 영역, 배지, 본문, 사이드바 CTA
- `app/stay/page.tsx` — food와 동일 구조
- `app/stay/[id]/page.tsx` — food와 동일 구조
- `app/events/page.tsx` — 히어로, 진행중/예정 섹션, 카드 그리드, 상태 배지

**제외:**
- 레이아웃/구조 변경, 신규 기능. 데이터 페칭(`getFoodList`/`getStayList`/`getEventList` 등), 필터링/정렬 로직, `notFound()` 처리는 그대로 유지.
- 섹션별 브랜드색(히어로 그라디언트, hover 테두리, 빈 이미지 플레이스홀더, 태그/상태 배지, "관광공사DB" 배지) 자체의 색상값 변경 — 토큰화하지 않고 지금 값 그대로 고정.
- `components/spots/SpotFilter.tsx`, `components/map/*`의 잔여 하드코딩 — 별도 후속 과제, 이번 라운드 무관.
- `/events`에 상세 페이지를 신규로 만드는 것 — 현재 없고, 이번 라운드는 있는 페이지만 리스킨한다.

## 컬러 토큰 매핑 — 목록 페이지 3개 공통 패턴 (`app/food/page.tsx`, `app/stay/page.tsx`, `app/events/page.tsx`)

| 요소 | 현재 (하드코딩) | 교체 후 |
|---|---|---|
| 히어로 그라디언트 | 섹션별 hex(예: food `from-orange-600 via-amber-500 to-yellow-500`) | **변경 없음(모드 불변 고정 유지)** |
| 히어로 서브텍스트 | `text-{color}-200`/`text-white/80` | `text-white/70` — 다른 라운드 히어로 텍스트와 통일 |
| 히어로 타이틀 `text-white` | 변경 없음 | |
| 빈 상태/데이터없음 `text-gray-400` | `text-foreground/60` | |
| 카드 컨테이너 `bg-white border-gray-200` | `bg-background border-border` | |
| 카드 hover 테두리(섹션별 `hover:border-{color}-200`) | **변경 없음(모드 불변 고정 유지)** | |
| 빈 이미지 플레이스홀더(섹션별 그라디언트+텍스트) | **변경 없음(모드 불변 고정 유지)** | |
| 카드 제목 `text-gray-900` | `text-foreground` | |
| 카드 주소 `text-gray-400` | `text-foreground/60` | |
| 태그 배지(섹션별 `bg-{color}-50 text-{color}-600`) | **변경 없음(모드 불변 고정 유지)** | |
| 하단 안내문 `text-gray-400` | `text-foreground/60` | |

### `/events` 전용 추가 요소

| 요소 | 현재 | 교체 후 |
|---|---|---|
| "진행 중"/"예정된 행사" 구분 dot(`bg-rose-500`/`bg-fuchsia-400`) | **변경 없음(고정)** | |
| 구분 타이틀 `text-gray-900` | `text-foreground` | |
| 상태 배지(`bg-rose-50 text-rose-600`/`bg-fuchsia-50 text-fuchsia-600`) | **변경 없음(고정)** | |
| 이벤트 장소/날짜 `text-gray-500` | `text-foreground/70` | |
| 이벤트 주소 `text-gray-400` | `text-foreground/60` | |

## 컬러 토큰 매핑 — 상세 페이지 2개 공통 패턴 (`app/food/[id]/page.tsx`, `app/stay/[id]/page.tsx`)

| 요소 | 현재 | 교체 후 |
|---|---|---|
| 페이지 배경 `bg-gray-50` | `bg-background` | |
| 히어로 이미지 영역 배경 `bg-gray-200` | `bg-muted` | |
| 빈 이미지 그라디언트(섹션별) | **변경 없음(고정)** | |
| 히어로 하단 어둡게 `bg-gradient-to-t from-black/50 via-transparent to-transparent` | 변경 없음 — 사진 위 텍스트 가독성용, 라이트/다크 무관 | |
| "← 목록" 버튼 `bg-white/90 text-gray-700 hover:bg-white` | `bg-background/90 text-foreground hover:bg-background` | |
| 카테고리 배지 `bg-white/90 text-gray-700` | `bg-background/90 text-foreground` | |
| "관광공사DB" 배지(섹션별 `bg-orange-500`/`bg-indigo-600`) | **변경 없음(고정)** | |
| 제목 `text-gray-900` | `text-foreground` | |
| 주소 `text-gray-500` | `text-foreground/70` | |
| overview 인용문 테두리(섹션별 `border-{color}-200`) | **변경 없음(고정)** | |
| overview 인용문 텍스트 `text-gray-700` | `text-foreground/80` | |
| 태그 배지 `bg-white border-gray-200 text-gray-500` | `bg-background border-border text-foreground/70` | |
| "카카오맵에서 보기" `bg-yellow-400 text-gray-900 hover:bg-yellow-300` | **변경 없음(카카오 고유 브랜드색, 모드 불변)** | |
| "AI로 동선 짜기" `bg-gradient-to-r from-sky-700 to-teal-600 shadow-lg shadow-sky-700/20` | `bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] shadow-lg` — 섹션 브랜드색이 아니라 사이트 공통 AI 큐레이터 CTA(다른 라운드의 결과 설명 카드 등과 동일 정체성)이므로 표준 그라디언트로 통일. `shadow-sky-700/20`은 색상 특정 그림자라 제거하고 `shadow-lg`만 유지 | |
| "목록으로" 버튼 `text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700` | `text-foreground/70 border-border hover:border-foreground/40 hover:text-foreground` | |
| 하단 안내문 `text-gray-400` | `text-foreground/60` | |

## 다크모드

기존 다섯 라운드와 동일 메커니즘(CSS 커스텀 프로퍼티 스왑, `.dark` 클래스 토글, `dark:` variant 불필요) — 토큰 교체 요소는 자동 적용. 섹션 브랜드색 요소(히어로/배지/hover테두리/빈이미지플레이스홀더)는 의도적으로 다크모드에서도 라이트 값 그대로 유지 — `primary-dark`+`hero-glow` 히어로 처리, `RouteMap.tsx`의 마커 색과 같은 원칙(모드 불변 브랜드 요소).

## 테스트 / 검증 계획

- `npx tsc --noEmit`, 대상 파일 `eslint`
- `npm run build`
- 각 파일에서 `grep -cE '(bg|text|border)-(gray|white)-[0-9]{2,3}|bg-white\b'` → 0 (섹션 브랜드색 자체는 `orange`/`indigo`/`rose`/`amber`/`yellow`/`violet`/`purple`/`fuchsia`/`pink` 등이라 이 grep 패턴에 안 걸림 — 의도적으로 남기는 색이므로 정상)
- `grep -n "sky-700\|teal-600" app/food/\[id\]/page.tsx app/stay/\[id\]/page.tsx` → 결과 없음 (AI 큐레이터 CTA 표준화 확인)
- `next dev`로 라이트/다크 각각 렌더 확인: 목록 화면(빈 상태 포함) 3개, 상세 화면(이미지 있음/없음 케이스) 2개, events의 진행중/예정 섹션 둘 다 있는 경우와 하나만 있는 경우
- 신규 조합 대비 검증: `bg-background/90 text-foreground`(상세 페이지 오버레이 버튼)는 사진 위에 얹히는 반투명 배경이라 `bg-background` 기준 검증 전제가 다름 — 라이트/다크 각각 실측 확인 필요(이전 라운드에서 사진/그라디언트 위 반투명 배지가 대비 실패한 선례 있음, `docs/superpowers/specs/2026-07-29-spots-redesign-design.md` 참고)
- 섹션 브랜드색 요소(고정 유지 대상)가 실수로 토큰화되지 않았는지 최종 diff에서 육안 확인 — 예: `hover:border-orange-200`이 `hover:border-primary/40` 등으로 바뀌면 안 됨
