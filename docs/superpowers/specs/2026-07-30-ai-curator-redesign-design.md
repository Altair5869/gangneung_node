# AI 큐레이터 페이지 리디자인 설계 (2026-07-30)

## 배경 및 목적

홈페이지·스팟 페이지 리디자인(2026-07-29)에서 만든 컬러 토큰·다크모드 시스템을 우선순위 3순위 페이지인 `/ai-curator`에 적용한다. 기획서 MVP 2순위 기능이자 홈페이지 메인 CTA 도착지라 우선순위가 높다.

현재 `app/ai-curator/page.tsx`는 `sky-700`/`blue-600`/`teal-600` 등 SaaS풍 하드코딩 Tailwind 색상을 쓰고 다크모드 지원이 전혀 없다. `components/map/RouteMap.tsx`(이 페이지 전용 인라인 지도)도 `#0369a1`/`#0d9488` 하드코딩 hex를 쓴다. `lib/spot-visuals.ts`에는 스팟 라운드에서 이미 만든 재사용 가능한 토큰 헬퍼(`categoryGradient`, `noiseBadge`, `powerBadge`, `congestionStyle`, `categoryLabel`)가 있어 이번 라운드에서 그대로 재사용한다.

## 범위

**포함:**
- `app/ai-curator/page.tsx` — 헤더 배너, Step 1~4 입력 폼, 결과 카드 전체(설명 카드/일정표/추천 장소 목록/팁/저장 폼) 리스킨 + 다크모드
- `components/map/RouteMap.tsx` — 로딩/에러 placeholder, 범례 pill 리스킨 + 다크모드. 마커/폴리라인 hex 값을 토큰 라이트값으로 정렬

**제외:**
- 레이아웃/구조 변경, 신규 기능. Step 폼 구조, 결과 카드 배치는 그대로 유지 — 색상 교체 + 다크모드만.
- `/map`, `/planner`, `/food`, `/stay`, `/events` — 후속 라운드.
- 카카오맵 타일 자체의 다크모드 대응 — 카카오 지도 SDK가 다크 타일을 지원하지 않아 범위 밖.

## 컬러 토큰 매핑

| 현재 (하드코딩) | 교체 후 (토큰) | 비고 |
|---|---|---|
| 헤더 배너 `from-sky-700 via-blue-600 to-teal-600` | `bg-primary-dark` (모드 불변) | 홈페이지 히어로와 동일 패턴 — 라이트/다크 분기 없음 |
| Step 활성 버튼 `bg-sky-700`/`bg-teal-600` | `bg-primary` / `text-on-primary` | |
| 그리드 배경 블롭(`bg-sky-100/60`, `bg-teal-100/50`, `blur-3xl`) | 제거 → `bg-background` | 스팟 라운드와 동일 결정(장식 불필요) |
| 결과 설명 카드 그라디언트(`from-sky-700 via-blue-600 to-teal-600`) | `from-primary to-primary-dark` | |
| 검증 실패 경고 배너(`bg-amber-50 border-amber-200 text-amber-800`) | `bg-warn/15 border-warn/30 text-warn` | `bg-background` 위에서만 검증된 반투명 배지 패턴 — 블롭 제거가 선행 조건 |
| 에러 배너(`bg-red-50 border-red-200 text-red-700`) | `bg-bad/15 border-bad/30 text-bad` | 상동 |
| 저장 완료 배너(`bg-green-50 border-green-200 text-green-700`) | `bg-good/15 border-good/30 text-good` | 상동 |
| 워케이션 팁(`bg-sky-50 border-sky-100 text-sky-800`, 번호 원 `bg-sky-700`) | `bg-primary/10 border-primary/20 text-primary`, 번호 원 `bg-primary text-on-primary` | |
| 저장 폼(`bg-gray-50 border-gray-200`, 버튼 `bg-gray-900`) | `bg-muted border-border`, 버튼 `bg-foreground text-background` | 스팟 라운드 필터 바와 동일 패턴 |
| 카테고리 배지(라이프 `bg-teal-100 text-teal-700` / 워크 `bg-gray-100 text-gray-500`) | 라이프 `bg-accent/15 text-accent` / 워크 `bg-muted text-foreground/60` | |
| 콘센트/무장애/혼잡도 배지, 카테고리 라벨 로컬 중복 정의(`congestionDot` 등) | `lib/spot-visuals.ts`의 `powerBadge`/`congestionStyle`/`categoryLabel` import로 교체 | 워크스팟 전용 카테고리(`cafe`/`coworking`/`library`/`hotel`/`other`)만 커버하므로, 라이프스팟 전용 카테고리(`attraction`/`food`)는 페이지 로컬 라벨맵에 남겨 병합 |
| 결과 목록 번호 원(인라인 스타일 `#0d9488`/`#0369a1`) | 라이프 `bg-accent text-on-accent` / 워크 `bg-primary text-on-primary` (Tailwind 클래스) | 인라인 스타일 제거 → 다크모드 자동 반영 |
| 입력 필드 포커스(`focus:border-sky-400`) | `focus:border-primary` | |
| 로딩 스피너(`border-gray-300 border-t-gray-500`) | `border-border border-t-foreground/50` | |

## RouteMap.tsx 처리

카카오맵 캔버스 내부(마커 오버레이, 폴리라인)는 지도 타일 자체가 다크모드를 지원하지 않아 항상 밝은 배경 위에 그려진다. 이 부분의 `WORK_COLOR`/`LIFE_COLOR` 상수와 폴리라인 `strokeColor`는 하드코딩 hex를 유지하되, 값만 토큰의 라이트 모드 hex로 정렬한다: `WORK_COLOR = "#0F6B62"`(`--color-primary` 라이트값), `LIFE_COLOR = "#B8511E"`(`--color-accent` 라이트값).

캔버스 밖(로딩/에러 placeholder, 범례 pill)은 일반 DOM이므로 Tailwind 토큰 클래스로 교체해 다크모드가 반영되게 한다: placeholder 배경 `bg-gray-50` → `bg-muted`, 텍스트 `text-gray-400` → `text-foreground/60`. 범례 pill(`bg-white/90`) → `bg-background/90`, 텍스트는 그대로 유지하되 스와치 두 개는 `style={{background: WORK_COLOR}}` 대신 `bg-primary`/`bg-accent` Tailwind 클래스로 교체(이 부분은 다크모드에서도 자연스럽게 갈라져야 하므로 인라인 hex가 아닌 토큰 클래스 사용).

## 다크모드

스팟 라운드와 동일한 메커니즘(CSS 커스텀 프로퍼티 스왑, `dark:` variant 불필요) — 위 토큰 교체만으로 자동 적용됨. 별도 인프라 작업 없음.

## 테스트 / 검증 계획

- `npx tsc --noEmit`, 대상 파일 `eslint`
- `npm run build`
- `next dev`로 라이트/다크 각각 렌더 확인: Step 1~4 폼 인터랙션, 로딩 스피너, 결과 카드(검증 실패 경고 배너 포함 케이스와 미포함 케이스 둘 다), 인라인 지도(로딩/정상/에러 상태), 저장 플로우(폼 열기→저장→"플래너에 저장되었습니다" 배너)
- 신규 조합 대비 검증: `bg-{warn,bad,good}/15 text-{token}` 조합은 스팟 라운드에서 `bg-background` 배경 기준 WCAG AA 검증이 이미 완료된 패턴을 그대로 재사용하는 것이므로 재계산 불필요. 단, 블롭 제거로 실제 배경이 `bg-background`가 되는지는 반드시 확인.
- `lib/spot-visuals.ts` 헬퍼 import 후 기존 로컬 중복 정의 삭제가 회귀를 일으키지 않는지(워크스팟 카테고리 라벨/배지 렌더링 결과가 리스킨 전후 동일한 텍스트를 보여주는지) 확인
