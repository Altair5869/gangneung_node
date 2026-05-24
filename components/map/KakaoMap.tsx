"use client";

import { useRef, useState, useEffect } from "react";
import { WorkSpot } from "@/types";
import { cn } from "@/lib/utils";
import MapSpotCard from "./MapSpotCard";

const GANGNEUNG = { lat: 37.7519, lng: 128.8759 };

const CONGESTION_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  default: "#6b7280",
};

interface Filters {
  noise: string;
  wifi: boolean;
  power: boolean;
}

function isVisible(spot: WorkSpot, filters: Filters): boolean {
  if (filters.noise && spot.noise !== filters.noise) return false;
  if (filters.wifi && !spot.wifi.available) return false;
  if (filters.power && !spot.power.available) return false;
  return true;
}

export default function KakaoMap({ spots }: { spots: WorkSpot[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const overlaysRef = useRef<Array<{ overlay: any; spot: WorkSpot }>>([]);

  const [selectedSpot, setSelectedSpot] = useState<WorkSpot | null>(null);
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
  };

  return (
    <div className="relative w-full h-full">
      {/* 지도 컨테이너 */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* 로딩 오버레이 */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
          <p className="text-gray-500 text-sm">지도 불러오는 중...</p>
        </div>
      )}

      {/* 에러 오버레이 */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-20">
          <div className="text-center p-6 bg-white rounded-2xl shadow border border-red-100">
            <p className="font-bold text-red-600 mb-2">지도 로딩 실패</p>
            <p className="text-sm text-red-500 mb-4">{errorMsg || "알 수 없는 오류"}</p>
            <p className="text-xs text-gray-400">
              카카오맵 API 키와 도메인 등록을 확인해주세요<br />
              (developers.kakao.com → 앱 → 플랫폼 → Web)
            </p>
          </div>
        </div>
      )}

      {/* 필터 패널 */}
      {status === "ready" && (
        <div className="absolute top-4 left-4 z-10 bg-white rounded-2xl shadow-lg border border-gray-100 p-3 space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">필터</span>
            <span className="text-xs text-gray-400">{visibleCount}곳</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-400">소음도</p>
            <div className="flex gap-1">
              {[
                { value: "quiet", label: "조용" },
                { value: "moderate", label: "보통" },
                { value: "noisy", label: "시끄" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleFilter("noise", opt.value)}
                  className={cn(
                    "flex-1 py-1 text-xs rounded-lg border transition-colors",
                    filters.noise === opt.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
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
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              )}
            >
              WiFi
            </button>
            <button
              onClick={() => toggleFilter("power")}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors",
                filters.power
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              )}
            >
              콘센트
            </button>
          </div>

          <div className="border-t border-gray-100 pt-2 space-y-1">
            <p className="text-xs text-gray-400">혼잡도</p>
            {[
              { color: "bg-green-400", label: "여유" },
              { color: "bg-yellow-400", label: "보통" },
              { color: "bg-red-400", label: "혼잡" },
              { color: "bg-gray-400", label: "정보없음" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", item.color)} />
                <span className="text-xs text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 선택된 장소 카드 */}
      {selectedSpot && (
        <MapSpotCard spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
      )}
    </div>
  );
}
