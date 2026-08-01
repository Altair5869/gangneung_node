import { Suspense } from "react";
import SpotsClient from "@/components/spots/SpotsClient";
import { buildSpotCorpus } from "@/lib/spot-corpus";

// 셀프 fetch가 cache:"no-store"였을 때와 동일하게 요청마다 렌더한다(app/map/page.tsx와 같은
// 이유 — 빼면 1시간 ISR로 정적화돼 시각 의존 congestion이 최대 1시간 낡는다).
export const dynamic = "force-dynamic";

// 로딩 UI를 app/spots/loading.tsx(세그먼트 파일)가 아니라 페이지 내부 <Suspense>로 넣는다.
// 세그먼트 loading.tsx는 하위 세그먼트(/spots/[id])까지 전파돼서, 상세 페이지의 notFound()가
// 응답 헤더 전송 후에 호출되며 404가 200으로 바뀐다(2026-07-30 실측으로 격리). 페이지 내부
// Suspense는 이 페이지의 서브트리에만 적용되므로 /spots/[id]의 404가 보존된다.
// 콜드 캐시(Data Cache 미스) 시 목록 조회가 수 초 걸리는 구간을 이 스켈레톤이 덮는다
// (2026-08-01 QA FIX-1: 프로덕션 콜드 실측 /map 4.265s).
export default function SpotsPage() {
  return (
    <Suspense fallback={<SpotsSkeleton />}>
      <SpotsContent />
    </Suspense>
  );
}

async function SpotsContent() {
  // /api/spots를 HTTP로 다시 호출하지 않고 코퍼스를 직접 만든다(셀프 fetch 제거 —
  // 왕복 비용과 NEXT_PUBLIC_BASE_URL 의존을 함께 없앤다). 이 페이지는 쿼리 파라미터를
  // 쓰지 않으므로 /api/spots의 필터 로직은 필요하지 않다.
  const allSpots = await buildSpotCorpus();

  return (
    <div className="flex flex-col min-h-screen">
      {/* 헤더 배너 — 라이트/다크 공용 짙은 톤 (홈페이지 히어로와 동일 패턴) */}
      <section className="bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-2">Workation Spots</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">강릉 워크스팟</h1>
          <p className="text-white/70 text-sm">
            한국관광공사 공식 데이터 기반 —&nbsp;
            <span className="text-white font-semibold">{allSpots.length}곳</span>의 장소를 탐색하세요
          </p>
        </div>
      </section>

      <SpotsClient allSpots={allSpots} />
    </div>
  );
}

// 실제 스팟 개수("N곳")·이름·필드값은 아직 모르므로 렌더하지 않는다 — 중립 회색 바만 둔다.
// 색은 기존 토큰(bg-muted / bg-border / border-border)만 사용해 라이트·다크 양쪽에서
// 배경과 구분되게 한다.
function SpotsSkeleton() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 히어로 배너 — 실제 페이지와 동일한 토큰 기반 그라디언트 */}
      <section className="bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] py-12">
        <div className="max-w-6xl mx-auto px-4 animate-pulse">
          <div className="h-3 w-28 rounded bg-white/25 mb-3" />
          <div className="h-9 w-56 rounded bg-white/30 mb-3" />
          {/* 스팟 개수 자리 — 숫자를 지어내지 않고 placeholder 바로 둔다 */}
          <div className="h-4 w-72 rounded bg-white/20" />
        </div>
      </section>

      {/* 필터 바 */}
      <div className="sticky top-14 z-30 bg-background border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-2.5 animate-pulse">
          <div className="h-9 w-full rounded-xl border border-border bg-muted" />
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 w-16 rounded-lg border border-border bg-muted" />
            ))}
          </div>
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="flex-1 bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-background overflow-hidden animate-pulse"
              >
                <div className="h-44 bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 rounded bg-border" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-5 w-16 rounded-full bg-muted" />
                    <div className="h-5 w-14 rounded-full bg-muted" />
                    <div className="h-5 w-20 rounded-full bg-muted" />
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <div className="h-3 w-20 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <span className="sr-only">워크스팟 목록을 불러오는 중입니다</span>
        </div>
      </div>
    </div>
  );
}
