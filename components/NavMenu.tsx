"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/spots", label: "워크스팟" },
  { href: "/stay", label: "숙박" },
  { href: "/food", label: "맛집" },
  { href: "/events", label: "행사/축제" },
  { href: "/ai-curator", label: "AI 큐레이터" },
  { href: "/map", label: "지도" },
  { href: "/planner", label: "플래너" },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* 데스크탑 nav */}
      <div className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "hover:text-gray-900 transition-colors",
              pathname === href && "text-gray-900 font-semibold"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* 모바일 햄버거 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 ml-auto"
        aria-label="메뉴 열기"
      >
        <span className={cn("block w-5 h-0.5 bg-gray-700 transition-all", open && "rotate-45 translate-y-2")} />
        <span className={cn("block w-5 h-0.5 bg-gray-700 transition-all", open && "opacity-0")} />
        <span className={cn("block w-5 h-0.5 bg-gray-700 transition-all", open && "-rotate-45 -translate-y-2")} />
      </button>

      {/* 모바일 드롭다운 */}
      {open && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-6 py-3.5 text-sm font-medium border-b border-gray-100 last:border-0 transition-colors",
                pathname === href
                  ? "text-sky-700 bg-sky-50 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
