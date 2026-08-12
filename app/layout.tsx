import type { Metadata } from "next";
import Link from "next/link";
import NavMenu from "@/components/NavMenu";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "강릉 노드 | Gangneung Node",
  description: "강릉 워케이션 장소 큐레이션 서비스",
};

const NO_FLASH_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SessionProviderWrapper>
          <header className="bg-background border-b border-border sticky top-0 z-50">
            <nav className="relative max-w-6xl mx-auto px-4 h-14 flex items-center gap-8">
              <Link href="/" className="font-bold text-lg tracking-tight flex-shrink-0 text-foreground">
                강릉 노드
              </Link>
              <NavMenu />
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
