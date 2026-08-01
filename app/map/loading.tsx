// /map 로딩 스켈레톤. 지도 영역과 동일한 h-[calc(100vh-3.5rem)] 형상만 잡아준다.
//
// 이 경로에 한해 세그먼트 loading.tsx를 쓰는 게 안전한 이유: app/map/page.tsx에는
// notFound() 호출도 동적 세그먼트도 없어서, 스트리밍으로 응답 헤더가 먼저 나가도 뒤늦게
// 바꿔야 할 상태 코드가 애초에 없다. (/spots 계열은 다르다 — 세그먼트 loading.tsx가 하위
// [id] 라우트까지 전파돼 notFound()의 404를 200으로 만들기 때문에, 그쪽은 페이지 내부
// <Suspense>를 쓴다. 2026-08-01 QA FIX-1)
//
// 스팟 개수·이름 등 아직 모르는 데이터는 렌더하지 않는다 — 중립 placeholder만 둔다.
export default function MapLoading() {
  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background p-4">
      <div className="w-full h-full rounded-2xl border border-border bg-muted animate-pulse flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-border" />
        <div className="h-3 w-32 rounded bg-border" />
        <span className="sr-only">지도를 불러오는 중입니다</span>
      </div>
    </div>
  );
}
