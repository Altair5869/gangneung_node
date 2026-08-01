import KakaoMap from "@/components/map/KakaoMap";
import { buildSpotCorpus } from "@/lib/spot-corpus";

// 셀프 fetch가 cache:"no-store"였을 때와 동일하게 요청마다 렌더한다. 이걸 빼면 이 페이지는
// buildSpotCorpus 내부 fetch의 revalidate:3600을 물려받아 1시간 ISR로 정적 프리렌더되는데,
// congestion이 estimateCongestion(시각 의존)이라 시(hour) 경계를 넘긴 낡은 혼잡도를 최대
// 1시간 노출한다(2026-07-30 빌드 출력으로 확인: ○ /map Revalidate 1h). 외부 API 응답 캐시는
// 그대로 유지되므로 이 설정에도 코퍼스 조회는 여전히 수십 ms다.
export const dynamic = "force-dynamic";

export default async function MapPage() {
  // /api/spots를 HTTP로 다시 호출하지 않고 코퍼스를 직접 만든다. 셀프 fetch는 왕복 비용만
  // 늘리고 NEXT_PUBLIC_BASE_URL에 의존하게 만들었다(프로덕션에서 이 값이 비면 서버가 자기
  // 자신이 아니라 localhost로 요청해 목록이 전부 빈다). 이 페이지는 쿼리 파라미터를 쓰지
  // 않으므로 /api/spots의 noise/wifi/power/barrierFree 필터 로직은 필요하지 않다.
  const spots = await buildSpotCorpus();
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <KakaoMap spots={spots} />
    </div>
  );
}
