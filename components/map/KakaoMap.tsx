"use client";

import { useRef, useState, useEffect } from "react";
import { WorkSpot, LifeSpot, WeatherForecast } from "@/types";
import { cn } from "@/lib/utils";
import MapSpotCard from "./MapSpotCard";
import MapLifeSpotCard from "./MapLifeSpotCard";

const GANGNEUNG = { lat: 37.7519, lng: 128.8759 };

const CONGESTION_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  default: "#6b7280",
};

// RouteMap.tsx의 LIFE_COLOR와 동일한 값(#B8511E) — 워크스팟(혼잡도 색 pill)과 명소(LifeSpot)
// 핀을 시각적으로 구분하기 위해 이미 검증된 색을 재사용한다(요구사항 문서 3번, AC4).
const LIFE_COLOR = "#B8511E";

// 클러스터 배지 색 — 혼잡도 pill(초록/노랑/빨강/회색)과도, 명소 물방울(LIFE_COLOR)과도 겹치지
// 않는 짙은 남색을 쓴다. 카카오맵 캔버스 위에 그려지는 요소라 다크모드 토큰이 아닌 고정 hex를
// 쓰는 기존 관례(CONGESTION_COLOR/LIFE_COLOR)를 그대로 따른다.
const CLUSTER_COLOR = "#1f2937";

// pill 라벨의 최대 폭(px). 이 상한이 없으면 "우리끼리키즈카페 스포츠마을 강릉회산점"처럼 긴
// 이름이 260px까지 늘어나 겹침 판정에 쓰는 폭 추정이 무의미해진다(2026-08-19 QA 실측). 넘치는
// 이름은 말줄임 처리하고 전체 이름은 title 툴팁으로 남긴다.
const PILL_MAX_PX = 150;
// pill 폭 추정: 12px bold 한글 기준 글자당 약 12px + 좌우 패딩/테두리 24px. 상한에 걸리면
// 실제 렌더 폭은 PILL_MAX_PX이므로 추정이 실제보다 커지는 방향(=겹침 판정이 보수적)으로만 틀린다.
function estimatePillWidth(name: string): number {
  return Math.min(PILL_MAX_PX, name.length * 12 + 24);
}
// 클러스터 배지의 고정 크기(px). **멤버 수와 무관하게 항상 이 크기다.**
// 예전에는 10곳 이상이면 44px로 키웠는데, 풀에서 재사용할 때 크기를 바꾸면 CustomOverlay가
// 엘리먼트를 재측정하지 않아 캐시된 옛 크기로 앵커 오프셋을 계산해 배지가 엉뚱한 자리에 그려졌다
// (2026-08-20 QA). 크기를 고정하면 생성 시점의 측정값이 영원히 유효하므로 이 어긋남이 원천 차단된다.
// 겹침 회피 상자(estimatePillWidth 최솟값 36px, MARKER_MIN_GAP_Y 48px)가 이 크기를 이미 덮는다.
const CLUSTER_BADGE_PX = 36;

// 자릿수가 늘어도 상자를 키우지 않고 글자만 줄여 넣는다(가변 크기 금지가 핵심이라 폰트로 흡수).
function clusterFontSize(count: number): string {
  if (count >= 100) return "10px";
  if (count >= 10) return "11px";
  return "13px";
}

// 두 마커가 세로로 이만큼 이내면 겹친 것으로 본다. pill 높이(약 26px)와 클러스터 배지 높이
// (CLUSTER_BADGE_PX)에 여유를 더한 값 — 둘의 yAnchor가 같아도 높이가 달라 실제 그려지는 위치가
// 어긋나므로(yAnchor는 높이 배수) 넉넉하게 잡는다.
const MARKER_MIN_GAP_Y = 48;
// 겹침으로 보지 않는 최소 가로 여백.
const MARKER_MIN_GAP_X = 8;

// idle 이벤트 → 재계산 사이의 디바운스(ms). 카카오 네이티브 더블클릭 줌은 애니메이션 도중에도
// idle을 발생시키는데, 그 타이밍에 오버레이를 대량으로 붙였다 뗐다 하면 SDK가 오버레이 레이어에
// 건 인라인 display:none을 복원하지 못하고 마커가 통째로 사라진다(2026-08-19 QA 재현).
// 애니메이션이 끝난 뒤에 한 번만 재계산하도록 지연시킨다.
const RENDER_DEBOUNCE_MS = 220;

// 마커 재배치를 트리거하는 지도 이벤트. idle만으로는 실제 재계산이 걸리지 않는 것을 실측으로
// 확인해(더블클릭 줌/팬 후에도 배치가 초기 상태로 고정) 줌·드래그 이벤트를 함께 구독한다.
// 전부 같은 디바운스를 거치므로 여러 이벤트가 겹쳐 발생해도 재계산은 한 번만 돈다.
const MAP_RENDER_EVENTS = ["idle", "zoom_changed", "dragend", "bounds_changed"] as const;

interface Filters {
  noise: string;
  wifi: boolean;
  power: boolean;
}

function isVisible(spot: WorkSpot, filters: Filters): boolean {
  if (filters.noise && spot.noise !== filters.noise) return false;
  if (filters.wifi && !spot.wifi.available) return false;
  if (filters.power && spot.power.level !== "충분함" && spot.power.level !== "제한적") return false;
  return true;
}

// weather: 기상청 단기예보 페이지 레벨 단일 호출 결과(app/map/page.tsx에서 1회만 fetch,
// AC3). 명소마다 다른 값이 아니라 모든 LifeSpot 카드가 동일 객체를 공유하므로 LifeSpot 필드로
// 복제해 붙이지 않고 이 prop 하나를 MapLifeSpotCard까지 그대로 threading한다(요구사항 문서
// 최상단 요약). 실패/키 미설정 시 null — 필수 prop이지만 값 자체는 null일 수 있다.
export default function KakaoMap({
  spots,
  lifeSpots = [],
  weather,
}: {
  spots: WorkSpot[];
  lifeSpots?: LifeSpot[];
  weather: WeatherForecast | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapObj = useRef<any>(null);
  // el(내용 엘리먼트)을 함께 들고 있는다 — 마커를 숨길 때 overlay.setMap(null)로 지도에서
  // 떼어내지 않고 이 엘리먼트의 display만 토글하기 때문이다. 이유는 renderMarkers 주석 참고.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlaysRef = useRef<Array<{ overlay: any; spot: WorkSpot; el: HTMLElement }>>([]);
  // 명소 오버레이도 참조를 들고 있어야 cleanup에서 지도에서 떼어낼 수 있다. 예전에는 생성만 하고
  // 참조를 버려서, effect가 재실행되면(dev StrictMode 이중 마운트) 떼어낼 방법 자체가 없었다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lifeOverlaysRef = useRef<any[]>([]);
  // 클러스터 배지 풀. 렌더링할 때마다 만들고 버리는 게 아니라 한 번 만든 오버레이를 재사용한다
  // (위치는 setPosition, 표시 여부는 el.display). 지도에 붙였다 떼는 동작을 반복하면 카카오
  // SDK가 오버레이 레이어를 숨긴 채 복원하지 못하는 회귀가 발생한다 — renderMarkers 주석 참고.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterPoolRef = useRef<Array<{ overlay: any; el: HTMLElement; members: WorkSpot[] }>>([]);
  // idle 리스너는 React state가 아니라 ref를 통해 최신 필터를 읽는다 — 초기화 effect의 의존성
  // 배열이 []라서 클로저에 갇힌 filters를 보면 필터 변경이 클러스터에 반영되지 않기 때문이다.
  const filtersRef = useRef<Filters>({ noise: "", wifi: false, power: false });
  const renderMarkersRef = useRef<() => void>(() => {});

  const [selectedSpot, setSelectedSpot] = useState<WorkSpot | null>(null);
  const [selectedLifeSpot, setSelectedLifeSpot] = useState<LifeSpot | null>(null);
  const [filters, setFilters] = useState<Filters>({ noise: "", wifi: false, power: false });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const visibleCount = spots.filter((s) => isVisible(s, filters)).length;

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;
    let timeoutTimer: ReturnType<typeof setTimeout>;
    // idle 디바운스용 타이머(scheduleRender). cleanup에서 반드시 함께 정리해야, 폐기된 실행분의
    // 지연 재계산이 새 지도 인스턴스 위에서 돌아가는 일이 없다.
    let renderTimer: ReturnType<typeof setTimeout>;
    let visibilityTimer: ReturnType<typeof setTimeout>;
    // 이 effect 실행분이 이미 폐기됐는지 표시한다. SDK 로드가 비동기라(폴링/스크립트 onload)
    // cleanup이 먼저 돌고 나서 initMap 콜백이 뒤늦게 실행되는 경우가 실제로 생기는데, 그때
    // 폐기된 실행분이 오버레이를 또 만들면 마커가 2세트가 된다(dev StrictMode 이중 마운트).
    let cancelled = false;
    let idleHandler: (() => void) | null = null;
    // 오버레이 레이어의 display 변화를 감시하는 옵저버(observeOverlayLayer 주석 참고).
    let layerObserver: MutationObserver | null = null;

    // 워크스팟/명소/클러스터 오버레이를 전부 지도에서 떼고 참조 배열을 비운다. 이전 구현은
    // 타이머만 정리하고 오버레이는 그대로 뒀고, overlaysRef는 push만 하고 초기화되지 않아
    // 재실행 때마다 배열이 누적됐다 — "같은 자리에 마커 2개, 그중 하나는 클릭해도 반응 없음"과
    // 필터 패널 "N곳"이 실제 DOM 마커 수와 어긋나던 원인이다.
    function teardownOverlays() {
      overlaysRef.current.forEach(({ overlay }) => overlay.setMap(null));
      overlaysRef.current = [];
      lifeOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      lifeOverlaysRef.current = [];
      clusterPoolRef.current.forEach(({ overlay }) => overlay.setMap(null));
      clusterPoolRef.current = [];
    }

    // 위경도 → 화면 픽셀 변환기. getBounds()/getSouthWest()/getNorthEast()와 컨테이너 크기만
    // 쓴다(Projection API에 의존하지 않는다 — 이 조합이 SDK에서 가장 안정적으로 검증돼 있다).
    // 겹침 판정을 위경도가 아니라 픽셀로 하는 이유: 겹치는지 여부는 실거리가 아니라 화면에서
    // 라벨 상자가 포개지느냐의 문제이고, 그래야 줌 레벨 예외 없이 같은 규칙이 통한다.
    // 계산에 실패하면 null을 반환하고 호출부가 클러스터링 없이 개별 마커를 그대로 그린다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function createProjector(map: any): ((lat: number, lng: number) => { x: number; y: number }) | null {
      const container = mapRef.current;
      if (!container || !container.clientWidth || !container.clientHeight) return null;
      const bounds = map.getBounds?.();
      if (!bounds) return null;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const swLat = sw.getLat();
      const swLng = sw.getLng();
      const spanLat = ne.getLat() - swLat;
      const spanLng = ne.getLng() - swLng;
      if (!(spanLat > 0) || !(spanLng > 0)) return null;
      const pxPerLat = container.clientHeight / spanLat;
      const pxPerLng = container.clientWidth / spanLng;
      // y는 위도가 클수록 화면 위쪽이므로 부호를 뒤집는다.
      return (lat, lng) => ({ x: (lng - swLng) * pxPerLng, y: (ne.getLat() - lat) * pxPerLat });
    }

    // 클러스터 배지는 풀에서 꺼내 재사용한다. 필요한 개수만큼 없으면 그때만 새로 만들고, 한 번
    // 만든 오버레이는 컴포넌트가 살아있는 동안 지도에서 떼지 않는다(남는 것은 display로 숨김).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function acquireClusterBadge(map: any) {
      const pooled = clusterPoolRef.current.find((c) => c.el.dataset.visible === "false");
      if (pooled) return pooled;

      const el = document.createElement("div");
      // 배지 상자 크기는 생성 시 한 번만 정하고 **이후 절대 바꾸지 않는다**(CLUSTER_BADGE_PX 주석 참고).
      // box-sizing:border-box라 2px 테두리를 포함해 정확히 CLUSTER_BADGE_PX가 된다.
      el.style.cssText = `background:${CLUSTER_COLOR};color:#fff;width:${CLUSTER_BADGE_PX}px;height:${CLUSTER_BADGE_PX}px;box-sizing:border-box;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid #fff;user-select:none;visibility:hidden;`;
      const overlay = new window.kakao.maps.CustomOverlay({
        map,
        position: new window.kakao.maps.LatLng(GANGNEUNG.lat, GANGNEUNG.lng),
        content: el,
        // pill과 같은 yAnchor를 쓴다 — 앵커가 다르면 겹침 판정에 쓴 상자 위치와 실제 렌더 위치가
        // 어긋나 클러스터 배지가 이웃 pill을 덮는다(2026-08-19 QA 지적 1번).
        yAnchor: 1.4,
        zIndex: 4,
      });
      const entry = { overlay, el, members: [] as WorkSpot[] };
      el.addEventListener("click", () => {
        // 클러스터 클릭 = 해당 영역으로 줌인. 두 단계씩 당겨야 한 번의 클릭으로 실제로 쪼개진다.
        const anchor = entry.members[0];
        if (!anchor) return;
        const current = map.getLevel();
        map.setCenter(new window.kakao.maps.LatLng(anchor.lat, anchor.lng));
        map.setLevel(Math.max(1, current - 2));
        // 레벨이 이미 최대라 줌 이벤트가 안 오는 경우까지 커버하려고 여기서도 예약해 둔다.
        scheduleRender();
      });
      clusterPoolRef.current.push(entry);
      return entry;
    }

    function showClusterBadge(
      badge: (typeof clusterPoolRef.current)[number],
      anchor: WorkSpot,
      members: WorkSpot[]
    ) {
      badge.members = members;
      // 상자 크기(width/height)는 절대 건드리지 않는다 — 자릿수가 늘면 **글자 크기만** 줄인다.
      // 재사용 시 크기를 바꾸면 CustomOverlay가 엘리먼트를 다시 측정하지 않아, 캐시된 옛 크기로
      // 앵커 오프셋(yAnchor 1.4 × 높이)을 계산해 배지가 앵커점에서 최대 70px 어긋난 자리에
      // 그려진다. renderMarkers가 확보해 둔 회피 상자는 앵커점 기준이라, 어긋난 배지가 이웃
      // pill을 덮어 클릭을 가로챈다(2026-08-20 QA 재현: 배지를 한 번 재사용한 뒤에만 발생해
      // 최초 생성 시점만 보면 정상으로 보였다).
      badge.el.style.fontSize = clusterFontSize(members.length);
      // display는 항상 flex로 두고 visibility만 토글한다 — display를 껐다 켜면 상자 크기가
      // 0이 되어 pill과 똑같은 앵커 오프셋 고착 문제가 배지에도 생긴다(setPillVisible 주석 참고).
      badge.el.style.visibility = "visible";
      badge.el.dataset.visible = "true";
      badge.el.textContent = String(members.length);
      // 클러스터에 묶인 장소명은 title(툴팁)로만 노출한다 — pill 라벨을 여기 다 그리면 애초에
      // 겹침을 없애려던 목적이 사라진다.
      badge.el.title = `${members.length}곳: ${members.map((m) => m.name).join(", ")}`;
      badge.el.setAttribute("data-cluster-count", String(members.length));
      badge.overlay.setPosition(new window.kakao.maps.LatLng(anchor.lat, anchor.lng));
    }

    function hideClusterBadge(badge: (typeof clusterPoolRef.current)[number]) {
      badge.members = [];
      badge.el.style.visibility = "hidden";
      badge.el.dataset.visible = "false";
      badge.el.removeAttribute("data-cluster-count");
    }

    // 카카오 SDK가 CustomOverlay 레이어에 건 인라인 display:none을 되돌린다. 네이티브 더블클릭
    // 줌 도중 오버레이를 대량으로 붙였다 뗐다 하면 SDK가 이 값을 복원하지 못하고 워크스팟 pill과
    // 명소 핀이 통째로 사라진 채 영구히 돌아오지 않는 경우가 관측됐다(2026-08-19 QA 재현 2회).
    // 우리가 만든 오버레이 엘리먼트의 조상만 거슬러 올라가며 확인하므로, SDK가 다른 목적으로
    // 숨긴 요소를 건드릴 위험은 없다.
    function restoreOverlayLayerVisibility() {
      const container = mapRef.current;
      if (!container) return;
      const anchor =
        container.querySelector("[data-workspot-id]") ??
        container.querySelector("[data-cluster-count]");
      if (!anchor) return;
      let node = anchor.parentElement;
      while (node && node !== container) {
        if (node.style.display === "none") node.style.display = "";
        node = node.parentElement;
      }
    }

    // 오버레이 레이어가 숨겨지는 것을 **지도 이벤트와 무관하게** 감시한다.
    //
    // 왜 이벤트로는 안 되는가(브라우저 실측 근거): 카카오 네이티브 더블클릭 줌이 실행되면 SDK가
    // CustomOverlay 레이어에 인라인 display:none을 걸어 워크스팟 pill과 명소 핀이 전부 사라지는데,
    // **그 줌 이후 idle/zoom_changed/bounds_changed/dragend 중 어느 것도 발생하지 않는다**
    // (계측 결과 이벤트 카운터가 전부 0에서 그대로, 재계산도 0회). 반면 setLevel()로 프로그램에서
    // 줌하면 세 이벤트가 정상 발생하고 재계산도 돈다. 즉 이 상태에서는 이벤트 구독으로 복구
    // 시점을 잡는 것 자체가 불가능하므로, DOM 변화를 직접 감시하는 방식으로 복구한다.
    //
    // 감시 대상은 우리 오버레이 엘리먼트의 조상 레이어 하나뿐이고, 하는 일은 display:none 해제와
    // 재배치 예약뿐이다 — SDK가 다른 목적으로 숨긴 요소나 다른 스타일은 건드리지 않는다.
    function observeOverlayLayer() {
      const container = mapRef.current;
      if (!container) return;
      const anchor =
        container.querySelector("[data-workspot-id]") ??
        container.querySelector("[data-cluster-count]");
      const layer = anchor?.parentElement?.parentElement;
      if (!layer || !(layer instanceof HTMLElement)) return;

      layerObserver?.disconnect();
      layerObserver = new MutationObserver(() => {
        if (cancelled || layer.style.display !== "none") return;
        // 줌 애니메이션이 끝나기 전에 되돌리면 SDK가 다시 숨길 수 있어 한 박자 늦춘다.
        clearTimeout(visibilityTimer);
        visibilityTimer = setTimeout(() => {
          if (cancelled) return;
          restoreOverlayLayerVisibility();
          // 이 경로로 들어왔다는 건 줌/이동이 있었는데 이벤트를 못 받았다는 뜻이므로,
          // 클러스터 배치도 새 화면 기준으로 다시 계산해준다.
          safeRenderMarkers();
        }, RENDER_DEBOUNCE_MS);
      });
      layerObserver.observe(layer, { attributes: true, attributeFilter: ["style"] });
    }

    // 필터 + 현재 화면 배치를 반영해 워크스팟 마커를 다시 그린다.
    //
    // 격자(grid) 방식을 버리고 **픽셀 거리 기반 greedy 그룹핑**으로 바꿨다(2026-08-19 QA FIX).
    // 격자는 "한 칸에 하나"만 보장할 뿐, 칸 경계를 사이에 둔 두 pill이 서로의 라벨을 덮는 걸
    // 구조적으로 막지 못했다(실측: level 7에서 클릭 시 엉뚱한 마커가 열림, level 3에서 완전히
    // 가려 클릭 불가한 pill 3개). 여기서는 이미 배치된 마커와 라벨 상자가 겹치면 그 마커에
    // 흡수시키므로, **표시되는 두 마커의 라벨 상자는 절대 겹치지 않는다**는 불변식이 성립한다.
    //
    // 줌 레벨 예외(NO_CLUSTER_LEVEL)도 없앴다. 판정이 화면 픽셀 기준이라 확대할수록 같은 실거리가
    // 더 먼 픽셀 거리가 되어 자연히 1:1로 분리된다 — 오히려 예전 레벨 예외가 "가장 확대한
    // 상태에서 가장 많이 겹치는" 역전을 만들고 있었다.
    //
    // 불변식: (클러스터 배지 숫자의 합) + (단독으로 그려진 마커 수) === 필터를 통과한 스팟 수.
    // 각 스팟은 정확히 하나의 그룹에만 속하므로 이중 계수가 없다.
    // **표시/숨김은 overlay.setMap이 아니라 내용 엘리먼트의 display로 한다**(2026-08-19 회귀 수정).
    // 원인: 오버레이를 지도에서 떼었다 붙였다(setMap(null)/setMap(map)) 반복하면, 카카오 네이티브
    // 더블클릭 줌 직후 SDK가 CustomOverlay 레이어에 건 인라인 display:none을 복원하지 못해 워크스팟
    // pill과 명소 핀이 통째로 사라지고 팬을 해도 돌아오지 않는다. HEAD와의 A/B로 확정했다
    // (HEAD: 더블클릭 줌 후에도 256개 전부 표시 / setMap 토글 버전: 0개, 레이어 display:none 잔존).
    // 모든 오버레이를 생성 시 한 번만 지도에 붙이고 그 뒤로는 떼지 않으면(=HEAD와 동일한 부착 패턴)
    // SDK의 레이어 관리 상태를 건드리지 않으므로 이 회귀가 발생하지 않는다.
    function renderMarkers() {
      const map = mapObj.current;
      if (!map) return;

      type Entry = (typeof overlaysRef.current)[number];

      // display가 아니라 **visibility**로 감춘다(2026-08-20 QA FIX). display:none이면 엘리먼트의
      // offsetWidth/Height가 0이 되는데, CustomOverlay는 붙일 때 잰 크기로 앵커 오프셋(margin)을
      // 정해두고 이후 다시 재지 않는다. 그래서 감춰진 채로 측정된 pill은 margin:0으로 굳어버려,
      // 다시 보이게 해도 앵커점 기준으로 가운데·위로 올라가지 않고 오른쪽 아래로 최대 45×27px
      // 밀린 자리에 그려진다. renderMarkers의 회피 상자는 앵커 기준이라 그만큼 이웃과 겹친다.
      // visibility:hidden은 레이아웃 상자를 유지하므로 측정값이 항상 올바르게 남는다.
      // (setMap(null)/setMap(map) 토글은 쓰지 않는다 — FIX 3 더블클릭 줌 마커 소실의 원인이다.)
      const setPillVisible = (entry: Entry, on: boolean) => {
        entry.el.style.visibility = on ? "visible" : "hidden";
        entry.el.dataset.visible = on ? "true" : "false";
      };

      const visible: Entry[] = [];
      overlaysRef.current.forEach((entry) => {
        if (isVisible(entry.spot, filtersRef.current)) visible.push(entry);
        // 필터로 숨겨진 마커는 감추고 클러스터 계수에도 포함하지 않는다(요구사항 1-3).
        else setPillVisible(entry, false);
      });

      const project = createProjector(map);
      if (!project) {
        // 좌표 변환을 못 구한 방어적 케이스 — 개별 마커를 그대로 전부 표시한다.
        visible.forEach((entry) => setPillVisible(entry, true));
        clusterPoolRef.current.forEach(hideClusterBadge);
        restoreOverlayLayerVisibility();
        return;
      }

      // groups[i].members[0]이 그 그룹의 앵커(자리를 선점한 마커)다. 순회 순서는 코퍼스 순서라
      // 같은 화면에서는 항상 같은 결과가 나온다.
      const groups: Array<{ x: number; y: number; halfWidth: number; members: Entry[] }> = [];
      visible.forEach((entry) => {
        const { x, y } = project(entry.spot.lat, entry.spot.lng);
        const halfWidth = estimatePillWidth(entry.spot.name) / 2;
        const hit = groups.find(
          (g) =>
            Math.abs(g.x - x) < g.halfWidth + halfWidth + MARKER_MIN_GAP_X &&
            Math.abs(g.y - y) < MARKER_MIN_GAP_Y
        );
        if (hit) hit.members.push(entry);
        else groups.push({ x, y, halfWidth, members: [entry] });
      });

      // 배지를 새로 배정하기 전에 전부 회수한다(재사용 풀). 지도에서 떼지는 않는다.
      clusterPoolRef.current.forEach(hideClusterBadge);

      groups.forEach((group) => {
        if (group.members.length === 1) {
          setPillVisible(group.members[0], true);
          return;
        }
        group.members.forEach((entry) => setPillVisible(entry, false));
        // 클러스터 배지는 앵커(자리를 선점한 첫 멤버)의 좌표에 놓는다. 멤버 좌표 평균을 쓰면
        // 그룹 밖으로 밀려나 이웃 마커 위에 얹힐 수 있다(QA 지적 1번의 직접 원인).
        showClusterBadge(
          acquireClusterBadge(map),
          group.members[0].spot,
          group.members.map((e) => e.spot)
        );
      });

      restoreOverlayLayerVisibility();
    }

    // renderMarkers가 던진 예외가 idle 콜백 밖으로 새어나가면 이후 이벤트 처리가 통째로 멈출 수
    // 있다(마커가 영영 갱신되지 않는 상태). 여기서 흡수하고 최소한 가시성 복구는 시도한다.
    function safeRenderMarkers() {
      try {
        renderMarkers();
      } catch {
        restoreOverlayLayerVisibility();
      }
    }

    // idle 디바운스. 마지막 idle로부터 RENDER_DEBOUNCE_MS가 지난 뒤 한 번만 재계산하고,
    // 애니메이션 종료 직후 SDK가 다시 display:none을 남기는 경우에 대비해 조금 더 늦은 시점에
    // 가시성만 한 번 더 확인한다(재계산이 아니라 확인이라 비용이 거의 없다).
    function scheduleRender() {
      clearTimeout(renderTimer);
      clearTimeout(visibilityTimer);
      renderTimer = setTimeout(() => {
        if (cancelled) return;
        safeRenderMarkers();
        visibilityTimer = setTimeout(() => {
          if (cancelled) return;
          restoreOverlayLayerVisibility();
        }, RENDER_DEBOUNCE_MS);
      }, RENDER_DEBOUNCE_MS);
    }

    function initMap() {
      if (cancelled) {
        // 폐기된 실행분이 남긴 타이머까지 여기서 확실히 정리한다(타임아웃 오탐 방지).
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        return;
      }
      if (!mapRef.current) {
        setErrorMsg("지도 컨테이너를 찾을 수 없습니다");
        setStatus("error");
        return;
      }
      try {
        // 재실행 방어 — 이전 실행분이 남긴 오버레이가 있으면 먼저 걷어내고 시작한다.
        teardownOverlays();

        const center = new window.kakao.maps.LatLng(GANGNEUNG.lat, GANGNEUNG.lng);
        const map = new window.kakao.maps.Map(mapRef.current, { center, level: 7 });
        mapObj.current = map;

        spots.forEach((spot) => {
          const pos = new window.kakao.maps.LatLng(spot.lat, spot.lng);
          const color = CONGESTION_COLOR[spot.congestion ?? "default"];

          const el = document.createElement("div");
          // max-width + 말줄임: 라벨 폭에 상한이 없으면 겹침 판정에 쓰는 폭 추정
          // (estimatePillWidth)이 실제와 어긋나 판정이 무의미해진다. 잘린 전체 이름은 title
          // 툴팁으로 남긴다(2026-08-19 QA 지적 2번).
          el.style.cssText = `background:${color};color:#fff;padding:5px 10px;border-radius:9999px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:2px solid #fff;user-select:none;max-width:${PILL_MAX_PX}px;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box;`;
          el.textContent = spot.name;
          el.title = spot.name;
          el.setAttribute("data-workspot-id", spot.id);
          el.addEventListener("click", () => {
            setSelectedSpot(spot);
            setSelectedLifeSpot(null);
            mapObj.current?.panTo(pos);
          });

          // 생성 시점에 map을 붙이고 그 뒤로는 절대 떼지 않는다(HEAD와 동일한 부착 패턴).
          // 표시 여부는 el.style.visibility로만 제어한다 — setMap 토글은 더블클릭 줌 후 오버레이
          // 레이어가 통째로 숨겨진 채 복구되지 않는 회귀를 일으킨다(renderMarkers 주석 참고).
          // 클러스터링 전 한 프레임 동안 겹쳐 보이는 걸 막기 위해 처음에는 감춰둔 채로 만들고,
          // 바로 아래에서 첫 renderMarkers가 표시 대상만 켠다. 이때 **display:none을 쓰면 안 된다**
          // — CustomOverlay가 부착 시점에 0×0으로 재고 그 값으로 앵커 오프셋을 굳혀버린다
          // (setPillVisible 주석 참고). visibility는 레이아웃 상자를 유지해 측정이 정확하다.
          el.style.visibility = "hidden";
          el.dataset.visible = "false";
          const overlay = new window.kakao.maps.CustomOverlay({
            map,
            position: pos,
            content: el,
            yAnchor: 1.4,
            zIndex: 3,
          });

          overlaysRef.current.push({ overlay, spot, el });
        });

        // 명소(LifeSpot) 레이어 — 워크스팟(둥근 알약 모양 혼잡도 pill)과 형태·색을 모두 달리해
        // 시각적으로 구분한다(요구사항 문서 3번, AC4). 소음/wifi/전력 필터는 WorkSpot 전용 필드라
        // LifeSpot엔 적용되지 않으므로 필터와 무관하게 항상 표시한다. 16px 물방울 아이콘이라
        // 겹쳐도 라벨이 잘리는 피해가 없어 클러스터링 대상에서 제외한다(요구사항 1-4).
        lifeSpots.forEach((life) => {
          const pos = new window.kakao.maps.LatLng(life.lat, life.lng);

          const el = document.createElement("div");
          el.style.cssText = `background:${LIFE_COLOR};width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;`;
          el.title = life.name;
          el.addEventListener("click", () => {
            setSelectedLifeSpot(life);
            setSelectedSpot(null);
            mapObj.current?.panTo(pos);
          });

          const overlay = new window.kakao.maps.CustomOverlay({
            map,
            position: pos,
            content: el,
            yAnchor: 1,
            zIndex: 2,
          });
          lifeOverlaysRef.current.push(overlay);
        });

        renderMarkersRef.current = safeRenderMarkers;
        safeRenderMarkers();
        // 오버레이 엘리먼트가 DOM에 붙은 뒤여야 레이어를 찾을 수 있으므로 첫 렌더 다음에 건다.
        observeOverlayLayer();

        // 줌/이동이 끝나면 배치를 다시 계산한다. 다만 idle을 받자마자 재계산하면 안 된다 —
        // 카카오 네이티브 더블클릭 줌은 애니메이션 도중에도 idle을 발생시키고, 그 타이밍의
        // 오버레이 재부착이 SDK의 레이어 가시성 복원과 경합해 마커가 통째로 사라진다
        // (2026-08-19 QA 재현). 디바운스로 애니메이션이 끝난 뒤 한 번만 돌게 한다.
        // idle 하나만 걸면 실제로 재계산이 일어나지 않는 것을 브라우저 실측으로 확인했다
        // (더블클릭 줌·팬 이후에도 마커 배치가 초기 상태 그대로 고정). 원인 규명 대신 zoom_changed/
        // dragend/bounds_changed를 함께 구독한다 — 전부 같은 디바운스를 거치므로 중복 발생해도
        // 재계산은 한 번만 돈다.
        idleHandler = () => scheduleRender();
        MAP_RENDER_EVENTS.forEach((type) => {
          window.kakao.maps.event.addListener(map, type, idleHandler!);
        });

        clearTimeout(timeoutTimer);
        setStatus("ready");
      } catch (e) {
        setErrorMsg(String(e));
        setStatus("error");
      }
    }

    function startPolling() {
      // 이미 폐기된 실행분(dev 이중 마운트에서 script.onload가 cleanup 뒤에 도착하는 경우)이
      // 폴링/타임아웃 타이머를 새로 걸지 않게 막는다. 이 가드가 없으면 폐기된 실행분의 10초
      // 타임아웃이 나중에 터져서, 정상 동작 중인 지도를 "로딩 실패"로 덮어버린다.
      if (cancelled) return;

      pollTimer = setInterval(() => {
        if (cancelled) {
          clearInterval(pollTimer);
          return;
        }
        if (!window.kakao?.maps) return;
        clearInterval(pollTimer);
        window.kakao.maps.load(initMap);
      }, 100);

      // 10초 안에 로드 안 되면 에러 표시
      timeoutTimer = setTimeout(() => {
        clearInterval(pollTimer);
        if (cancelled) return;
        setErrorMsg("카카오맵 로드 타임아웃 — API 키와 도메인 설정을 확인해주세요");
        setStatus("error");
      }, 10000);
    }

    // cleanup은 모든 분기에서 동일해야 한다. 예전에는 "이미 로드된 경우"/"스크립트 중복 삽입
    // 방지" 분기가 cleanup 없이 그냥 return해서, dev의 두 번째 effect 실행이 첫 번째가 만든
    // 오버레이를 전혀 정리하지 못했다 — 마커 2세트의 직접 원인.
    function cleanup() {
      cancelled = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      clearTimeout(renderTimer);
      clearTimeout(visibilityTimer);
      if (idleHandler && mapObj.current && window.kakao?.maps?.event) {
        MAP_RENDER_EVENTS.forEach((type) => {
          window.kakao.maps.event.removeListener(mapObj.current, type, idleHandler!);
        });
      }
      idleHandler = null;
      layerObserver?.disconnect();
      layerObserver = null;
      teardownOverlays();
      renderMarkersRef.current = () => {};
      mapObj.current = null;
    }

    // 이미 로드된 경우
    if (window.kakao?.maps) {
      window.kakao.maps.load(initMap);
      return cleanup;
    }

    // 스크립트 중복 삽입 방지
    if (document.querySelector('script[src*="dapi.kakao.com"]')) {
      startPolling();
      return cleanup;
    }

    // 스크립트 직접 주입
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`;
    script.onerror = () => {
      clearTimeout(timeoutTimer);
      // 폐기된 실행분의 onerror가 살아있는 지도 상태를 덮지 않게 한다(StrictMode에서는 컴포넌트
      // 인스턴스가 그대로 마운트된 채로 effect만 재실행되므로 setState가 실제 UI에 반영된다).
      if (cancelled) return;
      setErrorMsg(`스크립트 로드 실패 — 요청 URL: ${script.src}`);
      setStatus("error");
    };
    script.onload = startPolling;
    document.head.appendChild(script);

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필터 변경 시 재배치. 개별 오버레이를 여기서 직접 setMap 하지 않는다 — 표시 여부는 필터와
  // 클러스터 격자가 함께 결정하므로 renderMarkers 한 곳에서만 판단해야 개수가 어긋나지 않는다.
  useEffect(() => {
    filtersRef.current = filters;
    if (status !== "ready") return;
    renderMarkersRef.current();
  }, [filters, status]);

  const toggleFilter = (key: keyof Filters, value?: string) => {
    setFilters((prev) => {
      if (key === "noise") return { ...prev, noise: prev.noise === value ? "" : (value ?? "") };
      return { ...prev, [key]: !prev[key as "wifi" | "power"] };
    });
    setSelectedSpot(null);
    setSelectedLifeSpot(null);
  };

  return (
    <div className="relative w-full h-full">
      {/* 지도 컨테이너 */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* 로딩 오버레이 */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-20">
          <p className="text-foreground/60 text-sm">지도 불러오는 중...</p>
        </div>
      )}

      {/* 에러 오버레이 */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-bad/10 z-20">
          <div className="text-center p-6 bg-background rounded-2xl shadow border border-bad/30">
            <p className="font-bold text-bad mb-2">지도 로딩 실패</p>
            <p className="text-sm text-bad mb-4">{errorMsg || "알 수 없는 오류"}</p>
            <p className="text-xs text-foreground/60">
              카카오맵 API 키와 도메인 등록을 확인해주세요<br />
              (developers.kakao.com → 앱 → 플랫폼 → Web)
            </p>
          </div>
        </div>
      )}

      {/* 필터 패널 */}
      {status === "ready" && (
        <div className="absolute top-4 left-4 z-10 bg-background rounded-2xl shadow-lg border border-border p-3 space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">필터</span>
            <span className="text-xs text-foreground/60">{visibleCount}곳</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-foreground/60">소음도</p>
            <div className="flex gap-1">
              {[
                { value: "언급됨-조용함", label: "조용 언급" },
                { value: "언급됨-시끄러움", label: "시끄 언급" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleFilter("noise", opt.value)}
                  className={cn(
                    "flex-1 py-1 text-xs rounded-lg border transition-colors",
                    filters.noise === opt.value
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-background text-foreground/70 border-border hover:border-foreground/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => toggleFilter("wifi")}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors",
                filters.wifi
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-background text-foreground/70 border-border hover:border-foreground/40"
              )}
            >
              WiFi
            </button>
            <button
              onClick={() => toggleFilter("power")}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors",
                filters.power
                  ? "bg-accent text-on-accent border-accent"
                  : "bg-background text-foreground/70 border-border hover:border-foreground/40"
              )}
            >
              콘센트
            </button>
          </div>

          <div className="border-t border-border pt-2 space-y-1">
            <p className="text-xs text-foreground/60">혼잡도</p>
            {/* 캔버스 마커(CONGESTION_COLOR 고정 hex)와 색 맞춰야 해서 고정 Tailwind 클래스 유지, 토큰화 안 함 */}
            {[
              { color: "bg-green-400", label: "여유" },
              { color: "bg-yellow-400", label: "보통" },
              { color: "bg-red-400", label: "혼잡" },
              { color: "bg-gray-400", label: "정보없음" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", item.color)} />
                <span className="text-xs text-foreground/70">{item.label}</span>
              </div>
            ))}
          </div>

          {/* 명소(LifeSpot) 레이어 범례 — 워크스팟 마커(원형 pill)와 다른 물방울 모양 마커임을
              색 견본으로도 안내한다(RouteMap.tsx의 LIFE_COLOR 범례와 동일한 색). */}
          <div className="border-t border-border pt-2 flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 inline-block"
              style={{ background: LIFE_COLOR, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)" }}
            />
            <span className="text-xs text-foreground/70">명소(관광지·문화시설)</span>
          </div>

          {/* 클러스터 배지 범례 — 겹쳐 있는 워크스팟을 개수로 묶은 것이며, 클릭하면 그 영역으로
              줌인해 개별 마커로 분리된다는 걸 안내한다. */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ background: CLUSTER_COLOR }}
            >
              N
            </span>
            <span className="text-xs text-foreground/70">겹친 워크스팟(클릭 시 확대)</span>
          </div>
        </div>
      )}

      {/* 선택된 장소 카드 */}
      {selectedSpot && (
        <MapSpotCard spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
      )}
      {selectedLifeSpot && (
        <MapLifeSpotCard spot={selectedLifeSpot} weather={weather} onClose={() => setSelectedLifeSpot(null)} />
      )}
    </div>
  );
}
