import Link from "next/link";

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
              Gangneung Workation
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-tight mb-6">
              바다 앞에서<br />
              <span className="text-white drop-shadow">일하세요.</span>
            </h1>
            <p className="text-lg text-white/85 mb-10 max-w-xl leading-relaxed">
              강릉의 카페, 코워킹 스페이스, 도서관을 AI가 분석해 최적의 워케이션 동선을 추천합니다.
              실시간 혼잡도와 무장애 정보까지 한 번에.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/spots"
                className="px-7 py-4 bg-white text-sky-600 rounded-xl font-semibold text-sm hover:bg-sky-50 transition-colors shadow-lg shadow-sky-600/20"
              >
                워크스팟 둘러보기
              </Link>
              <Link
                href="/ai-curator"
                className="px-7 py-4 bg-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/30 transition-colors border border-white/40"
              >
                AI 동선 짜기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 스탯 배너 */}
      <section className="bg-white border-b border-gray-100 py-10">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-4xl font-bold text-gray-900">50<span className="text-teal-500">+</span></p>
            <p className="text-sm text-gray-500 mt-1">강릉 워크스팟</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900">예상</p>
            <p className="text-sm text-gray-500 mt-1">혼잡도 정보</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-gray-900">AI</p>
            <p className="text-sm text-gray-500 mt-1">맞춤 동선 추천</p>
          </div>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              강릉 워케이션을 더 스마트하게
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              한국관광공사 공식 데이터를 기반으로 검증된 정보를 제공합니다.
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
              tag="무장애"
              title="모두를 위한 워케이션 정보"
              description="휠체어 접근, 엘리베이터, 장애인 화장실 등 무장애 편의시설 정보를 제공합니다."
              color="emerald"
              href="/spots?barrierFree=true"
              cta="무장애 스팟 보기"
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
              { value: "100+", label: "카페 & 코워킹" },
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
            지금 바로 시작해보세요
          </h2>
          <p className="text-gray-500 mb-8">
            AI가 당신의 업무 스타일에 맞는 강릉 워케이션 동선을 만들어드립니다.
          </p>
          <Link
            href="/ai-curator"
            className="inline-block px-8 py-4 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-700 transition-colors"
          >
            AI 동선 만들기
          </Link>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-gray-50 border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-bold text-gray-900">강릉 노드</p>
          <p className="text-xs text-gray-400">
            본 서비스는 한국관광공사 공공 데이터를 활용합니다.
          </p>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/spots" className="hover:text-gray-900 transition-colors">워크스팟</Link>
            <Link href="/ai-curator" className="hover:text-gray-900 transition-colors">AI 큐레이터</Link>
            <Link href="/map" className="hover:text-gray-900 transition-colors">지도</Link>
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
  color: "blue" | "teal" | "emerald";
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
