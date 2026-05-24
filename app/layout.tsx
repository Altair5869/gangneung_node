import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "강릉 노드 | Gangneung Node",
  description: "강릉 워케이션 장소 큐레이션 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-8">
            <Link href="/" className="font-bold text-lg tracking-tight">
              강릉 노드
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
              <Link href="/spots" className="hover:text-gray-900 transition-colors">
                워크스팟
              </Link>
              <Link href="/ai-curator" className="hover:text-gray-900 transition-colors">
                AI 큐레이터
              </Link>
              <Link href="/map" className="hover:text-gray-900 transition-colors">
                지도
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
