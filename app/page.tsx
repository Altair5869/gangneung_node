import Link from "next/link";
import { Suspense } from "react";
import WeatherWidget from "@/components/WeatherWidget";
import HorizonDivider from "@/components/HorizonDivider";

const DAY_FLOW = [
  {
    eyebrow: "01",
    title: "일하기",
    description: "카페·코워킹·도서관 230+곳 중에서 소음도, 콘센트 여부로 필터링해 딱 맞는 곳을 찾으세요.",
    href: "/spots",
    cta: "워크스팟 보기",
  },
  {
    eyebrow: "02",
    title: "먹기",
    description: "한국관광공사 공식 데이터로 확인한 강릉 현지 맛집 30곳.",
    href: "/food",
    cta: "맛집 보기",
  },
  {
    eyebrow: "03",
    title: "즐기기",
    description: "관광지·전망 명소를 지도에서 한눈에.",
    href: "/map",
    cta: "지도 보기",
  },
  {
    eyebrow: "04",
    title: "축제",
    description: "강릉단오제 등 지역 축제·행사 일정을 관광공사 공식 데이터로 미리 확인하세요.",
    href: "/events",
    cta: "행사 보기",
  },
  {
    eyebrow: "05",
    title: "자기",
    description: "한국관광공사 공식 데이터 기반 호텔·펜션·게스트하우스 정보.",
    href: "/stay",
    cta: "숙박 보기",
  },
];

const ENABLERS = [
  {
    eyebrow: "AI 큐레이터",
    title: "AI가 짜주는 하루 워케이션 동선",
    description: "업무 스타일과 시간을 입력하면 AI가 최적의 이동 동선과 장소를 큐레이션합니다.",
    href: "/ai-curator",
    cta: "동선 만들기",
  },
  {
    eyebrow: "데이터 신뢰성",
    title: "전화 확인·방문으로 검증한 정보만",
    description: "24곳은 전화 확인과 방문으로 WiFi·콘센트·소음을 직접 검증했습니다. 확인되지 않은 정보는 추정하지 않고 '미확인'으로 표시합니다.",
    href: "/spots",
    cta: "검증된 스팟 보기",
  },
  {
    eyebrow: "플래너",
    title: "내 동선 저장하고 공유하기",
    description: "AI 큐레이터 추천 동선을 저장해 언제든 꺼내보고 링크로 공유하세요.",
    href: "/planner",
    cta: "플래너 열기",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 히어로 — 라이트/다크 공용 짙은 톤 */}
      <section className="relative overflow-hidden min-h-[88vh] flex items-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))]">
        <div className="relative max-w-6xl mx-auto px-4 py-24 w-full">
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-semibold tracking-widest text-white/80 uppercase mb-6">
              Gangneung Workation Platform
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-tight mb-6">
              바다 앞에서<br />
              <span className="text-white drop-shadow">일하세요.</span>
            </h1>
            <p className="text-lg text-white/85 mb-10 max-w-xl leading-relaxed">
              일할 공간부터 맛집, 숙박까지 — 한국관광공사 공식 데이터와 AI가
              강릉 워케이션의 모든 동선을 설계합니다.
            </p>
            <div className="flex flex-wrap gap-4 mb-8">
              <Link
                href="/ai-curator"
                className="px-7 py-4 bg-white text-hero-glow rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors shadow-lg shadow-black/10"
              >
                AI 동선 만들기
              </Link>
              <Link
                href="/spots"
                className="px-7 py-4 bg-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/30 transition-colors border border-white/40"
              >
                워크스팟 둘러보기
              </Link>
            </div>
            <Suspense fallback={null}>
              <WeatherWidget />
            </Suspense>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 text-white/15">
          <HorizonDivider />
        </div>
      </section>

      {/* 스탯 배너 */}
      <section className="bg-background border-b border-border py-10">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-4xl font-bold text-foreground">230<span className="text-accent">+</span></p>
            <p className="text-sm text-foreground/60 mt-1">강릉 워크스팟</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-foreground">6<span className="text-primary">종</span></p>
            <p className="text-sm text-foreground/60 mt-1">관광공사 API 활용</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-foreground">24<span className="text-accent">곳</span></p>
            <p className="text-sm text-foreground/60 mt-1">실측 검증 완료</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary">AI</p>
            <p className="text-sm text-foreground/60 mt-1">맞춤 동선 큐레이션</p>
          </div>
        </div>
      </section>

      {/* 강릉에서의 하루 (시간 흐름 5스텝) */}
      <section className="py-16 bg-muted">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">강릉에서의 하루</h2>
            <p className="text-foreground/60 text-sm">워케이션의 모든 순간을 하나의 플랫폼에서</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {DAY_FLOW.map((item) => (
              <SectionCard key={item.eyebrow} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* 이걸 가능하게 하는 것 (도구/신뢰 요소 3개) */}
      <section className="py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-accent uppercase mb-4">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 3v2M12 3c-2 2-2 4 0 6s2 4 0 6M8 8c1 1 1 2 0 3M16 8c-1 1-1 2 0 3" strokeLinecap="round" />
              </svg>
              Why Gangneung Node
            </span>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              이걸 가능하게 하는 것
            </h2>
            <p className="text-foreground/60 max-w-lg mx-auto">
              한국관광공사 공식 OpenAPI 데이터 · AI 동선 최적화 · 전화·방문으로 실측 검증한 워크스팟 정보
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ENABLERS.map((item) => (
              <SectionCard key={item.eyebrow} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* 강릉 소개 배너 — 라이트/다크 공용 짙은 톤 */}
      <section className="relative overflow-hidden py-20 bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))]">
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <p className="text-white/70 text-sm font-semibold tracking-widest uppercase mb-4">Why Gangneung</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            왜 강릉인가요?
          </h2>
          <p className="text-white/85 leading-relaxed max-w-2xl mx-auto mb-10">
            서울에서 KTX로 2시간, 동해 바다와 백두대간이 공존하는 강릉.
            스페셜티 커피 문화와 넓은 카페 문화권, 그리고 빠른 인터넷 인프라로
            디지털 노마드에게 최적의 환경을 제공합니다.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { value: "2시간", label: "서울 → KTX" },
              { value: "230+", label: "워크스팟" },
              { value: "기가", label: "인터넷 인프라" },
              { value: "365일", label: "워케이션 가능" },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-2xl p-4 border border-white/10">
                <p className="text-2xl font-bold text-white">{item.value}</p>
                <p className="text-xs text-white/85 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute top-0 left-0 right-0 rotate-180 text-white/10">
          <HorizonDivider />
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="bg-background py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            오늘의 강릉 동선, AI에게 맡겨보세요
          </h2>
          <p className="text-foreground/60 mb-8">
            업무 스타일과 선호를 입력하면 AI가 워크스팟부터 맛집·관광지까지<br className="hidden sm:block" />
            최적 이동 동선으로 하루를 설계해드립니다.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/ai-curator"
              className="inline-block px-8 py-4 bg-accent text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              AI 동선 만들기
            </Link>
            <Link
              href="/planner"
              className="inline-block px-8 py-4 border border-border text-foreground rounded-xl font-semibold text-sm hover:border-primary transition-colors"
            >
              내 플래너 보기
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-muted border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-bold text-foreground">강릉 노드</p>
          <p className="text-xs text-foreground/60">
            본 서비스는 한국관광공사 공공 데이터를 활용합니다.
          </p>
          <div className="flex flex-wrap gap-5 text-sm text-foreground/70">
            <Link href="/spots" className="hover:text-foreground transition-colors">워크스팟</Link>
            <Link href="/stay" className="hover:text-foreground transition-colors">숙박</Link>
            <Link href="/food" className="hover:text-foreground transition-colors">맛집</Link>
            <Link href="/events" className="hover:text-foreground transition-colors">행사/축제</Link>
            <Link href="/ai-curator" className="hover:text-foreground transition-colors">AI 큐레이터</Link>
            <Link href="/map" className="hover:text-foreground transition-colors">지도</Link>
            <Link href="/planner" className="hover:text-foreground transition-colors">플래너</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  href,
  cta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-background rounded-2xl border border-border p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3"
    >
      <span className="text-xs font-bold tracking-widest text-accent">{eyebrow}</span>
      <div>
        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-sm text-foreground/60 mt-2 leading-relaxed">{description}</p>
      </div>
      <span className="text-sm font-semibold text-primary mt-auto">{cta} →</span>
    </Link>
  );
}
