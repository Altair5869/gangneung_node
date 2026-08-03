# /planner 페이지 리디자인 설계 (2026-08-03)

## 배경 및 목적

홈페이지·스팟·AI 큐레이터·`/map` 리디자인에서 만든 컬러 토큰·다크모드 시스템을 `/planner`(워케이션 플래너 — 저장된 동선 관리/공유)에 적용한다. `/planner`는 이번 라운드로 리스킨이 완결되는 **마지막 페이지**다(다른 모든 페이지/공용 컴포넌트는 레거시 팔레트 잔존 0줄, `/planner`만 28종/38줄 남아있음, 2026-08-03 사전 검토 확인).

사전 검토(`pm-analyst`, 2026-08-03)에서 `/planner`의 공유 링크 파손 버그(base64 URL-safe 인코딩 문제)를 별도로 발견해 이미 수정·배포했다(커밋 `b0f9478`). 이번 리디자인은 그 수정 이후 상태를 대상으로 하며, 기능 변경은 포함하지 않는다.

## 범위

**포함:**
- `app/planner/page.tsx` — 히어로 배너(×2, `PlannerContent`/`SharedPlanView`), 플랜 카드 목록, 빈 상태, 카드 펼침 상세, 워케이션 팁 박스, 공유뷰 전체, 순번 배지, Suspense fallback — 리스킨 + 다크모드
- `lib/spot-visuals.ts` — `categoryLabel` 타입을 `WorkSpot["category"] | LifeSpot["category"]`로 확장, `attraction`/`stay`/`food` 3개 키 추가

**제외:**
- 레이아웃/구조 변경, 신규 기능. 저장/삭제/공유링크복사/공유본저장 동작은 색상 교체 전후로 완전히 동일해야 한다.
- `Suspense` 경계 구조(`page.tsx:16-22`) — `10d8c57` 백지화면 이력 있어 변경 금지.
- 검토에서 발견된 별도 기능 이슈(URL 길이 과다, 삭제 확인 없음, 공유본 중복 저장, 20건 상한 미고지) — 이번 라운드와 무관, 후속 티켓.
- `app/ai-curator/page.tsx`의 자체 `lifeCategoryLabel`(`food: "식당"`, 플래너의 `"음식점"`과 다름) — 기존부터 있던 별개의 불일치, 이번 라운드에서 안 건드림.
- `/food`, `/stay`, `/events` — 후속 라운드.

## 컬러 토큰 매핑

| 현재 (하드코딩) | 교체 후 (토큰) | 비고 |
|---|---|---|
| 히어로 배경 `bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800` (`:62`, `:246` 2곳) | `bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))]`(모드 불변) | 홈페이지 히어로와 동일 패턴 — **정정(2026-08-03 최종 리뷰)**: 최초 작성 시 값 컬럼에 `bg-primary-dark`만 적었으나 이는 비고("홈페이지 히어로와 동일 패턴")와 모순. 홈페이지·AI큐레이터·스팟 히어로는 전부 두 색 그라디언트를 씀. 구현 단계에서 이 모순을 못 잡고 값 컬럼 그대로 따라가 리뷰에서 재작업 발생 — 후속 라운드는 값 컬럼을 최종 기준으로 삼을 것 |
| 히어로 라벨/서브텍스트 `text-gray-400` | `text-white/70` | 히어로는 모드 불변 짙은 배경이므로 `text-white` 계열 유지 |
| 히어로 타이틀 `text-white` | `text-white` | 변경 없음 |
| 플랜 카드 컨테이너 `bg-white border-gray-200` (`:117`) | `bg-background border-border` | |
| 카드 헤더 hover `hover:bg-gray-50` | `hover:bg-muted` | |
| 카드 제목 `text-gray-900` | `text-foreground` | |
| 본문 보조 텍스트 `text-gray-400`(×11)/`text-gray-500`/`text-gray-600` | `text-foreground/60` | AA 대비 확보 — `text-foreground/40`나 `/50`은 쓰지 않는다(`d60ba07`, `/map` 라운드에서 반복 확인된 미달 값) |
| "복사됨" 배지 `bg-green-100 text-green-700` | `bg-good/15 text-good` | |
| 링크 버튼(기본) `bg-gray-100 text-gray-600 hover:bg-gray-200` | `bg-muted text-foreground/70 hover:bg-border` | **정정(2026-08-03 최종 리뷰)**: 최초 값 `hover:bg-muted/70`은 기본 `bg-muted`보다 더 옅어져 호버가 오히려 "비활성화"처럼 보이고, 카드 헤더 자체가 호버 시 `bg-muted`로 바뀌어서 버튼이 배경에 묻히는 문제 발생. `bg-muted`보다 어두운(다크모드에선 밝은) `hover:bg-border`로 정정 |
| 삭제 버튼 `bg-red-50 text-red-500 hover:bg-red-100` | `bg-bad/15 text-bad hover:bg-bad/25` | |
| 펼침 화살표 `text-gray-400` | `text-foreground/60` | |
| 펼침 상세 구분선 `border-gray-100` | `border-border` | |
| 펼침 상세 설명 `text-gray-600` | `text-foreground/70` | |
| 워케이션 팁 박스 `bg-sky-50 border-sky-100`, 타이틀 `text-sky-800`, 항목 `text-sky-700` | `bg-primary/10 border-primary/20`, 타이틀/항목 `text-primary` | AI 큐레이터 팁 박스와 동일 패턴 |
| 순번 배지 인라인 `style={{background: life ? "#0d9488" : "#0369a1"}}` (`:198`) | `bg-accent`(LifeSpot) / `bg-primary`(WorkSpot) — Tailwind 클래스로 전환, 텍스트도 `text-on-accent`/`text-on-primary`로 명시(기존 고정 `text-white`는 다크모드에서 대비 무너질 수 있음) | AI 큐레이터 결과목록 순번원과 동일 시맨틱(WorkSpot=primary, LifeSpot=accent). 인라인 `style` 제거 → 다크모드 자동 반영 |
| 스팟 행 이름 `text-gray-900` | `text-foreground` | |
| 스팟 행 주소/카테고리뱃지/혼잡도 `text-gray-400`, `bg-gray-100 text-gray-500` | `text-foreground/60`, `bg-muted text-foreground/60` | |
| CTA 버튼(빈 상태·공유뷰 저장) `bg-sky-700 hover:bg-sky-600 text-white` | `bg-primary text-on-primary hover:opacity-90` | |
| 공유뷰 설명 카드 `bg-gradient-to-br from-sky-700 to-teal-600` | `bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))]`(모드 불변) + `shadow-xl` | 히어로와 통일 — AI큐레이터 라운드에서 "브랜드 강조 카드는 accent 아닌 primary-dark+hero-glow 모드불변 조합" 교훈 재적용. **정정(2026-08-03 최종 리뷰)**: 위 히어로와 동일한 이유로 값 컬럼을 그라디언트로 정정, `app/ai-curator/page.tsx`의 동일 카드와 시각적으로 통일하기 위해 `shadow-xl`도 추가 |
| 공유뷰 설명 카드 라벨 `text-sky-300` | `text-white/70` | |
| 공유뷰 팁 박스 | 위 워케이션 팁 박스와 동일 매핑(`bg-primary/10` 등) | |
| 공유뷰 팁 번호원 `bg-sky-700` | `bg-primary text-on-primary` | |
| "저장 완료" 배지 `bg-green-100 text-green-700` | `bg-good/15 text-good` | |
| "플래너 보기" 링크 버튼 `border-gray-200 text-gray-600 hover:border-gray-400` | `border-border text-foreground/70 hover:border-foreground/40` | |
| 유효하지 않은 링크 화면 `text-gray-500`, `text-sky-600` | `text-foreground/70`, `text-primary` | |
| Suspense fallback `text-gray-400` | `text-foreground/60` | |
| 빈 상태 텍스트 `text-gray-400` | `text-foreground/60` | |

## `categoryLabel` 통합

`lib/spot-visuals.ts`:
```ts
export const categoryLabel: Record<WorkSpot["category"] | LifeSpot["category"], string> = {
  cafe: "카페", coworking: "코워킹", library: "도서관",
  hotel: "호텔", other: "기타",
  attraction: "관광지", stay: "숙박", food: "음식점",
};
```
`app/planner/page.tsx:10-14`의 로컬 정의를 삭제하고 `import { categoryLabel } from "@/lib/spot-visuals"`로 교체한다. 추가 3개 키(`attraction`/`stay`/`food`)의 값은 기존 planner 로컬 정의와 동일해 렌더 결과가 바뀌지 않는다 — 순수 위치 이동. 타입을 유니온으로 넓히는 것은 기존 소비처(`SpotCard.tsx`, `app/ai-curator/page.tsx`의 `workCategoryLabel`)를 깨지 않는다 — 좁은 타입(`WorkSpot["category"]`)으로 인덱싱하는 기존 호출부는 그대로 유효하다.

## 다크모드

기존 네 라운드와 동일 메커니즘(CSS 커스텀 프로퍼티 스왑, `.dark` 클래스 토글, `dark:` variant 불필요) — 위 토큰 교체만으로 자동 적용. 별도 인프라 작업 없음.

## 테스트 / 검증 계획

- `npx tsc --noEmit`, 대상 파일 `eslint`
- `npm run build`
- `grep -cE '(bg|text|border|from|via|to)-(gray|sky|teal|red|green)-[0-9]{2,3}' app/planner/page.tsx` → 0
- `grep -n "style={{ background" app/planner/page.tsx` → 결과 없음 (인라인 hex 제거 확인)
- `next dev`로 라이트/다크 각각 렌더 확인: 목록 화면(빈 상태 / 카드 1개 이상), 카드 펼침 상태, "복사됨" 상태(클릭 직후), 삭제 동작(기능 불변 확인), `?share=` 정상 화면, `?share=`에 유효하지 않은 값을 넣은 화면, Suspense 로딩 순간(느린 네트워크 시뮬레이션 또는 코드 리뷰로 대체)
- 신규 조합 대비 검증: `bg-good/15 text-good`, `bg-bad/15 text-bad`, `bg-primary/10 text-primary`, `bg-muted text-foreground/70` 등은 스팟·AI큐레이터 라운드에서 `bg-background` 배경 기준 이미 검증된 패턴 재사용 — 재계산 불필요. 단 `text-on-accent`/`text-on-primary`가 순번 배지에 처음 쓰이는 조합이므로 라이트/다크 각각 육안 확인.
- `categoryLabel` 통합 후 플랜 카드의 카테고리 배지(WorkSpot 5종 + LifeSpot 3종)가 리스킨 전과 동일한 한글 라벨을 보여주는지 확인 — 특히 `attraction`/`stay`/`food` 회귀 여부(타입 확장 실수 시 타입에러 또는 폴백으로 영문 노출 가능성, 사전 검토에서 지적된 리스크)
