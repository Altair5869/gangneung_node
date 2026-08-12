"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import AuthButton from "@/components/AuthButton";

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
  const [theme, setTheme] = useState<Theme>("light");
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getStoredTheme());
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <>
      {/* 데스크탑 nav */}
      <div className="hidden md:flex items-center gap-5 text-sm font-medium text-foreground/70 ml-auto">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "hover:text-foreground transition-colors",
              pathname === href && "text-foreground font-semibold"
            )}
          >
            {label}
          </Link>
        ))}
        <AuthButton />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      {/* 모바일: 토글 + 햄버거 */}
      <div className="md:hidden flex items-center gap-1 ml-auto">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          aria-label="메뉴 열기"
        >
          <span className={cn("block w-5 h-0.5 bg-foreground/70 transition-all", open && "rotate-45 translate-y-2")} />
          <span className={cn("block w-5 h-0.5 bg-foreground/70 transition-all", open && "opacity-0")} />
          <span className={cn("block w-5 h-0.5 bg-foreground/70 transition-all", open && "-rotate-45 -translate-y-2")} />
        </button>
      </div>

      {/* 모바일 드롭다운 */}
      {open && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-background border-b border-border shadow-lg z-50">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-6 py-3.5 text-sm font-medium border-b border-border last:border-0 transition-colors",
                pathname === href
                  ? "text-primary bg-muted font-semibold"
                  : "text-foreground/70 hover:bg-muted"
              )}
            >
              {label}
            </Link>
          ))}
          <div className="px-6 py-3.5 border-t border-border">
            <AuthButton />
          </div>
        </div>
      )}
    </>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="w-8 h-8 flex items-center justify-center rounded-full text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
