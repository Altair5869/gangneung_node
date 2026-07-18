import Link from "next/link";
import { Suspense } from "react";
import WeatherWidget from "@/components/WeatherWidget";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 히어로 */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-700 via-blue-600 to-teal-600 min-h-[88vh] flex items-center">
        {/* 배경 장식 */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[600px] h-[600px] bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />

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
                className="px-7 py-4 bg-white text-sky-600 rounded-xl font-semibold text-sm hover:bg-sky-50 transition-colors shadow-lg shadow-sky-600/20"
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
      </section>

      {/* 스탯 배너 */}
      <section className="bg-white border-b border-gray-100 py-10">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-4xl font-bold text-gray-900">230<span className="text-teal-500">+</span></p>
            <p className="text-sm text-gray-500 mt-1">강릉 워크스팟</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900">6<span className="text-indigo-500">종</span></p>
            <p className="text-sm text-gray-500 mt-1">관광공사 API 활용</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900">24<span className="text-emerald-500">곳</span></p>
            <p className="text-sm text-gray-500 mt-1">실측 검증 완료</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900 text-sky-600">AI</p>
            <p className="text-sm text-gray-500 mt-1">맞춤 동선 큐레이션</p>
          </div>
        </div>
      </section>

      {/* 워케이션 플로우 */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">강릉에서의 하루</h2>
            <p className="text-gray-500 text-sm">워케이션의 모든 순간을 하나의 플랫폼에서</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { step: "01", title: "일하기", desc: "카페·코워킹·도서관 230+곳", href: "/spots", color: "sky" },
              { step: "02", title: "먹기", desc: "강릉 현지 맛집 30곳", href: "/food", color: "orange" },
              { step: "03", title: "즐기기", desc: "관광지·전망 명소", href: "/map", color: "teal" },
              { step: "04", title: "축제", desc: "강릉 지역 행사·축제", href: "/events", color: "rose" },
              { step: "05", title: "자기", desc: "호텔·펜션·게스트하우스", href: "/stay", color: "indigo" },
            ].map((item) => (
              <Link key={item.step} href={item.href} className="group bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3">
                <span className={`text-xs font-bold tracking-widest text-${item.color}-500`}>{item.step}</span>
                <div>
                  <p className="font-bold text-gray-900 group-hover:text-sky-700 transition-colors">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/ai-curator"
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900 transition-colors"
            >
              AI가 이 모든 동선을 한 번에 설계해드립니다 →
            </Link>
          </div>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              강릉 워케이션, 이렇게 달라집니다
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              한국관광공사 공식 OpenAPI 데이터 · AI 동선 최적화 · 전화·방문으로 실측 검증한 워크스팟 정보
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              tag="워크스팟"
              title="내 업무 스타일에 맞는 장소 찾기"
              description="소음도, WiFi 속도, 콘센트 여부로 필터링해 딱 맞는 장소를 빠르게 찾아보세요."
              color="blue"
              href="/spots"
              cta="스팟 보기"
            />
            <FeatureCard
              tag="AI 큐레이터"
              title="AI가 짜주는 하루 워케이션 동선"
              description="업무 스타일과 시간을 입력하면 AI가 최적의 이동 동선과 장소를 큐레이션합니다."
              color="teal"
              href="/ai-curator"
              cta="동선 만들기"
            />
            <FeatureCard
              tag="데이터 신뢰성"
              title="전화 확인·방문으로 검증한 정보만"
              description="24곳은 전화 확인과 방문으로 WiFi·콘센트·소음을 직접 검증했습니다. 확인되지 않은 정보는 추정하지 않고 '미확인'으로 표시합니다."
              color="emerald"
              href="/spots"
              cta="검증된 스팟 보기"
            />
            <FeatureCard
              tag="숙박"
              title="강릉 숙박시설 한눈에"
              description="한국관광공사 공식 데이터 기반 호텔·펜션·게스트하우스 정보를 제공합니다."
              color="indigo"
              href="/stay"
              cta="숙박 보기"
            />
            <FeatureCard
              tag="맛집"
              title="워케이션 중 식사 걱정 없이"
              description="강릉 현지 음식점 정보를 한국관광공사 공식 데이터로 확인하세요."
              color="orange"
              href="/food"
              cta="맛집 보기"
            />
            <FeatureCard
              tag="행사/축제"
              title="강릉 지역 행사·축제 한눈에"
              description="관광공사 공식 데이터로 강릉단오제 등 지역 축제와 행사 일정을 미리 확인하세요."
              color="rose"
              href="/events"
              cta="행사 보기"
            />
            <FeatureCard
              tag="플래너"
              title="내 동선 저장하고 공유하기"
              description="AI 큐레이터 추천 동선을 저장해 언제든 꺼내보고 링크로 공유하세요."
              color="gray"
              href="/planner"
              cta="플래너 열기"
            />
          </div>
        </div>
      </section>

      {/* 강릉 소개 배너 */}
      <section className="bg-gradient-to-r from-sky-700 to-teal-600 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
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
                <p className="text-xs text-slate-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="bg-white py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            오늘의 강릉 동선, AI에게 맡겨보세요
          </h2>
          <p className="text-gray-500 mb-8">
            업무 스타일과 선호를 입력하면 AI가 워크스팟부터 맛집·관광지까지<br className="hidden sm:block" />
            최적 이동 동선으로 하루를 설계해드립니다.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/ai-curator"
              className="inline-block px-8 py-4 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-700 transition-colors"
            >
              AI 동선 만들기
            </Link>
            <Link
              href="/planner"
              className="inline-block px-8 py-4 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:border-gray-400 transition-colors"
            >
              내 플래너 보기
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-gray-50 border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-bold text-gray-900">강릉 노드</p>
          <p className="text-xs text-gray-400">
            본 서비스는 한국관광공사 공공 데이터를 활용합니다.
          </p>
          <div className="flex flex-wrap gap-5 text-sm text-gray-500">
            <Link href="/spots" className="hover:text-gray-900 transition-colors">워크스팟</Link>
            <Link href="/stay" className="hover:text-gray-900 transition-colors">숙박</Link>
            <Link href="/food" className="hover:text-gray-900 transition-colors">맛집</Link>
            <Link href="/events" className="hover:text-gray-900 transition-colors">행사/축제</Link>
            <Link href="/ai-curator" className="hover:text-gray-900 transition-colors">AI 큐레이터</Link>
            <Link href="/map" className="hover:text-gray-900 transition-colors">지도</Link>
            <Link href="/planner" className="hover:text-gray-900 transition-colors">플래너</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  tag,
  title,
  description,
  color,
  href,
  cta,
}: {
  tag: string;
  title: string;
  description: string;
  color: "blue" | "teal" | "emerald" | "indigo" | "orange" | "gray" | "rose";
  href: string;
  cta: string;
}) {
  const colorMap = {
    blue: {
      tag: "bg-blue-100 text-blue-700",
      border: "hover:border-blue-300",
      cta: "text-blue-600 hover:text-blue-800",
    },
    teal: {
      tag: "bg-teal-100 text-teal-700",
      border: "hover:border-teal-300",
      cta: "text-teal-600 hover:text-teal-800",
    },
    emerald: {
      tag: "bg-emerald-100 text-emerald-700",
      border: "hover:border-emerald-300",
      cta: "text-emerald-600 hover:text-emerald-800",
    },
    indigo: {
      tag: "bg-indigo-100 text-indigo-700",
      border: "hover:border-indigo-300",
      cta: "text-indigo-600 hover:text-indigo-800",
    },
    orange: {
      tag: "bg-orange-100 text-orange-700",
      border: "hover:border-orange-300",
      cta: "text-orange-600 hover:text-orange-800",
    },
    rose: {
      tag: "bg-rose-100 text-rose-700",
      border: "hover:border-rose-300",
      cta: "text-rose-600 hover:text-rose-800",
    },
    gray: {
      tag: "bg-gray-100 text-gray-700",
      border: "hover:border-gray-400",
      cta: "text-gray-600 hover:text-gray-900",
    },
  }[color];

  return (
    <div className={`bg-white rounded-2xl p-6 border border-gray-200 ${colorMap.border} transition-colors flex flex-col gap-4`}>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start ${colorMap.tag}`}>
        {tag}
      </span>
      <div>
        <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
      <Link href={href} className={`text-sm font-semibold mt-auto ${colorMap.cta} transition-colors`}>
        {cta} →
      </Link>
    </div>
  );
}
