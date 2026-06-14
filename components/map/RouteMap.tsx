"use client";

import { useRef, useState, useEffect } from "react";
import { RouteStop, isLifeSpot } from "@/types";

const WORK_COLOR = "#0369a1";
const LIFE_COLOR = "#0d9488";

export default function RouteMap({ stops }: { stops: RouteStop[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;
    let timeoutTimer: ReturnType<typeof setTimeout>;

    function initMap() {
      if (!mapRef.current || stops.length === 0) { setStatus("ready"); return; }
      try {
        const avgLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
        const avgLng = stops.reduce((s, p) => s + p.lng, 0) / stops.length;
        const center = new window.kakao.maps.LatLng(avgLat, avgLng);
        const map = new window.kakao.maps.Map(mapRef.current, { center, level: 7 });

        const linePath: unknown[] = [];

        stops.forEach((stop, i) => {
          const pos = new window.kakao.maps.LatLng(stop.lat, stop.lng);
          linePath.push(pos);
          const color = isLifeSpot(stop) ? LIFE_COLOR : WORK_COLOR;

          const el = document.createElement("div");
          el.style.cssText = `background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;`;
          el.textContent = String(i + 1);

          new window.kakao.maps.CustomOverlay({
            map,
            position: pos,
            content: el,
            yAnchor: 1.5,
            zIndex: 3,
          });
        });

        if (linePath.length > 1) {
          new window.kakao.maps.Polyline({
            map,
            path: linePath,
            strokeWeight: 3,
            strokeColor: "#0369a1",
            strokeOpacity: 0.6,
            strokeStyle: "solid",
          });
        }

        const bounds = new window.kakao.maps.LatLngBounds();
        linePath.forEach((p) => bounds.extend(p));
        map.setBounds(bounds);

        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }

    function startPolling() {
      pollTimer = setInterval(() => {
        if (!window.kakao?.maps) return;
        clearInterval(pollTimer);
        window.kakao.maps.load(initMap);
      }, 100);
      timeoutTimer = setTimeout(() => {
        clearInterval(pollTimer);
        setStatus("error");
      }, 10000);
    }

    if (window.kakao?.maps) { window.kakao.maps.load(initMap); return; }
    if (document.querySelector('script[src*="dapi.kakao.com"]')) { startPolling(); return; }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`;
    script.onload = startPolling;
    script.onerror = () => { clearTimeout(timeoutTimer); setStatus("error"); };
    document.head.appendChild(script);

    return () => { clearInterval(pollTimer); clearTimeout(timeoutTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 300 }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <p className="text-gray-400 text-sm">지도 불러오는 중...</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <p className="text-gray-400 text-sm">지도를 불러올 수 없습니다</p>
        </div>
      )}

      {status === "ready" && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow text-xs flex gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: WORK_COLOR }} />
            워크스팟
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: LIFE_COLOR }} />
            라이프스팟
          </span>
        </div>
      )}
    </div>
  );
}
