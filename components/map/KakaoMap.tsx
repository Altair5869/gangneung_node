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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlaysRef = useRef<Array<{ overlay: any; spot: WorkSpot }>>([]);

  const [selectedSpot, setSelectedSpot] = useState<WorkSpot | null>(null);
  const [selectedLifeSpot, setSelectedLifeSpot] = useState<LifeSpot | null>(null);
  const [filters, setFilters] = useState<Filters>({ noise: "", wifi: false, power: false });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const visibleCount = spots.filter((s) => isVisible(s, filters)).length;

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;
    let timeoutTimer: ReturnType<typeof setTimeout>;

    function initMap() {
      if (!mapRef.current) {
        setErrorMsg("지도 컨테이너를 찾을 수 없습니다");
        setStatus("error");
        return;
      }
      try {
        const center = new window.kakao.maps.LatLng(GANGNEUNG.lat, GANGNEUNG.lng);
        const map = new window.kakao.maps.Map(mapRef.current, { center, level: 7 });
        mapObj.current = map;

        spots.forEach((spot) => {
          const pos = new window.kakao.maps.LatLng(spot.lat, spot.lng);
          const color = CONGESTION_COLOR[spot.congestion ?? "default"];

          const el = document.createElement("div");
          el.style.cssText = `background:${color};color:#fff;padding:5px 10px;border-radius:9999px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:2px solid #fff;user-select:none;`;
          el.textContent = spot.name;
          el.addEventListener("click", () => {
            setSelectedSpot(spot);
            setSelectedLifeSpot(null);
            mapObj.current?.panTo(pos);
          });

          const overlay = new window.kakao.maps.CustomOverlay({
            map,
            position: pos,
            content: el,
            yAnchor: 1.4,
            zIndex: 3,
          });

          overlaysRef.current.push({ overlay, spot });
        });

        // 명소(LifeSpot) 레이어 — 워크스팟(둥근 알약 모양 혼잡도 pill)과 형태·색을 모두 달리해
        // 시각적으로 구분한다(요구사항 문서 3번, AC4). 소음/wifi/전력 필터는 WorkSpot 전용 필드라
        // LifeSpot엔 적용되지 않으므로 필터와 무관하게 항상 표시한다.
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

          new window.kakao.maps.CustomOverlay({
            map,
            position: pos,
            content: el,
            yAnchor: 1,
            zIndex: 2,
          });
        });

        clearTimeout(timeoutTimer);
        setStatus("ready");
      } catch (e) {
        setErrorMsg(String(e));
        setStatus("error");
      }
    }

    function startPolling() {
      pollTimer = setInterval(() => {
        if (!window.kakao?.maps) return;
        clearInterval(pollTimer);
        window.kakao.maps.load(initMap);
      }, 100);

      // 10초 안에 로드 안 되면 에러 표시
      timeoutTimer = setTimeout(() => {
        clearInterval(pollTimer);
        setErrorMsg("카카오맵 로드 타임아웃 — API 키와 도메인 설정을 확인해주세요");
        setStatus("error");
      }, 10000);
    }

    // 이미 로드된 경우
    if (window.kakao?.maps) {
      window.kakao.maps.load(initMap);
      return;
    }

    // 스크립트 중복 삽입 방지
    if (document.querySelector('script[src*="dapi.kakao.com"]')) {
      startPolling();
      return;
    }

    // 스크립트 직접 주입
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`;
    script.onerror = () => {
      clearTimeout(timeoutTimer);
      setErrorMsg(`스크립트 로드 실패 — 요청 URL: ${script.src}`);
      setStatus("error");
    };
    script.onload = startPolling;
    document.head.appendChild(script);

    return () => {
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필터 변경 시 오버레이 표시/숨김
  useEffect(() => {
    if (status !== "ready") return;
    overlaysRef.current.forEach(({ overlay, spot }) => {
      overlay.setMap(isVisible(spot, filters) ? mapObj.current : null);
    });
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
