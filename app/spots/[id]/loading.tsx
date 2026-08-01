// /spots/[id] 로딩 스켈레톤. 히어로(h-64/sm:h-80) + 2:1 그리드 형상만 잡고,
// 스팟 이름·주소·필드값은 렌더하지 않는다(아직 모르는 값이므로).
//
// [의도적으로 감수한 트레이드오프 — 2026-08-01 리더 결정]
// 이 파일이 만드는 Suspense 경계 때문에 존재하지 않는 id의 HTTP 상태가 404 → 200이 된다
// (스트리밍으로 응답 헤더가 먼저 나가면 뒤이은 notFound()가 상태 코드를 바꿀 수 없다 —
// Next.js 16 문서 loading.md의 "Status Codes" 절, 2026-07-30 실측으로 격리).
// 상태 코드를 지키면서 스켈레톤을 보여줄 방법은 구조적으로 없다: notFound() 여부를 결정하는
// fetch가 바로 그 느린 fetch(getSpotById의 미캐시 Tourism/Kakao 조회)이기 때문이다.
// 정상 스팟의 콜드 조회가 최대 12.8초 백지인 흔한 경우를 우선하기로 했다. 없는 id 직접 접속은
// URL 오타/봇 정도로 드물고, 그 경우에도 404 페이지 본문과 noindex 메타는 정상 출력된다.
// → 따라서 이 라우트에서 200이 나오는 것은 회귀가 아니라 예상된 동작이다.
export default function SpotDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* 히어로 */}
      <div className="relative w-full h-64 sm:h-80 bg-muted animate-pulse">
        <div className="absolute top-5 left-5 h-8 w-28 rounded-full bg-background/90" />
        <div className="absolute bottom-5 left-5 flex gap-2">
          <div className="h-7 w-20 rounded-full bg-background/90" />
          <div className="h-7 w-24 rounded-full bg-background/90" />
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">

          {/* 왼쪽: 주요 정보 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 제목 + 주소 */}
            <div className="space-y-2">
              <div className="h-8 w-2/3 rounded bg-border" />
              <div className="h-3.5 w-1/2 rounded bg-muted" />
            </div>

            {/* 설명 */}
            <div className="border-l-4 border-border pl-4 space-y-2">
              <div className="h-3.5 w-full rounded bg-muted" />
              <div className="h-3.5 w-5/6 rounded bg-muted" />
            </div>

            {/* 핵심 스펙 카드들 */}
            <div className="space-y-3">
              <div className="h-3 w-24 rounded bg-border" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-background border border-border border-l-4 border-l-border rounded-2xl p-4 space-y-2"
                  >
                    <div className="h-3 w-14 rounded bg-muted" />
                    <div className="h-4 w-20 rounded bg-border" />
                  </div>
                ))}
              </div>
            </div>

            {/* 무장애 편의시설 */}
            <div className="border border-border rounded-2xl p-5 space-y-3">
              <div className="h-3.5 w-28 rounded bg-border" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-6 w-24 rounded-full bg-muted" />
                ))}
              </div>
            </div>

            {/* 태그 */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-6 w-20 rounded-full border border-border bg-muted" />
              ))}
            </div>
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-4">
            <div className="border border-border rounded-2xl p-5 space-y-3">
              <div className="h-3 w-24 rounded bg-border" />
              <div className="h-10 w-20 rounded bg-muted" />
              <div className="h-2 w-full rounded-full bg-muted" />
            </div>
            <div className="border border-border rounded-2xl h-44 bg-muted" />
            <div className="h-12 w-full rounded-2xl bg-muted" />
            <div className="h-10 w-full rounded-2xl border border-border bg-background" />
          </div>
        </div>
        <span className="sr-only">장소 상세 정보를 불러오는 중입니다</span>
      </div>
    </div>
  );
}
