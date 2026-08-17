import KakaoMap from "@/components/map/KakaoMap";
import { buildSpotCorpus, buildMapAttractionSpots } from "@/lib/spot-corpus";
import { attachNearbyParking } from "@/lib/gn-traffic-api";
import { attachBeachIndex } from "@/lib/khoa-beach-api";

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
  // 명소 레이어는 WorkSpot 코퍼스와 중복 표시되면 안 되므로(요구사항 문서 AC3), spots에서
  // 이미 채택된 tourismContentId 집합을 먼저 만들어 buildMapAttractionSpots에 넘긴다
  // (bfContentIds 패턴, lib/spot-corpus.ts의 buildSpotCorpus 참고).
  const workSpotContentIds = new Set(
    spots.map((s) => s.tourismContentId).filter((id): id is string => Boolean(id))
  );
  const attractionSpots = await buildMapAttractionSpots(workSpotContentIds);
  // 강릉시 주차 연동(2026-08-16): category === "attraction"인 명소에만 반경 1km 내 주차장을
  // 매칭한다(요구사항 문서 3, 5절). 관광공사 API 호출과 별도 실패 경로이므로 attachNearbyParking
  // 자체가 Promise.all/빈 배열 폴백을 내부에서 처리한다 — 여기서 추가 try-catch는 불필요.
  const spotsWithParking = await attachNearbyParking(attractionSpots);
  // 국립해양조사원 해수욕지수 연동(2026-08-17): category === "attraction"이고 이름에 "해변"/
  // "해수욕장"이 포함된 명소에만 이름 정규화 매칭으로 붙는다(요구사항 문서 4절). 주차 연동과
  // 별도 실패 경로이므로 attachBeachIndex 자체가 폴백(null)을 내부에서 처리한다 — 여기서
  // 추가 try-catch는 불필요(attachNearbyParking과 동일 원칙).
  const lifeSpots = await attachBeachIndex(spotsWithParking);
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <KakaoMap spots={spots} lifeSpots={lifeSpots} />
    </div>
  );
}
