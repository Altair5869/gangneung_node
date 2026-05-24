"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const NOISE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "quiet", label: "조용함" },
  { value: "moderate", label: "보통" },
  { value: "noisy", label: "시끄러움" },
];

export default function SpotFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const noise = searchParams.get("noise") ?? "";
  const wifi = searchParams.get("wifi") === "true";
  const power = searchParams.get("power") === "true";
  const barrierFree = searchParams.get("barrierFree") === "true";

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value) params.delete(key);
      else params.set(key, value);
      router.push(`/spots?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-500 mr-1">소음</span>
        {NOISE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update("noise", opt.value || null)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg border transition-colors",
              noise === opt.value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => update("wifi", wifi ? null : "true")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
            wifi
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          )}
        >
          <span>WiFi</span>
        </button>
        <button
          onClick={() => update("power", power ? null : "true")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
            power
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          )}
        >
          <span>콘센트</span>
        </button>
        <button
          onClick={() => update("barrierFree", barrierFree ? null : "true")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
            barrierFree
              ? "bg-teal-600 text-white border-teal-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          )}
        >
          <span>무장애</span>
        </button>
      </div>
    </div>
  );
}
