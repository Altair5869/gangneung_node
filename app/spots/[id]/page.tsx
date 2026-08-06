import { notFound } from "next/navigation";
import Link from "next/link";
import { noiseLabel, congestionLabel, cn, isBarrierFree } from "@/lib/utils";
import WorkEnvScore from "@/components/spots/WorkEnvScore";
import { categoryLabel, categoryGradient, noiseBadge, congestionStyle, BARRIER_FREE_FIELDS } from "@/lib/spot-visuals";
import { getSpotById } from "@/lib/spot-detail";

export const dynamic = "force-dynamic";

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // /api/spots/[id] 라우트와 동일한 조회·병합 함수를 직접 호출한다(셀프 fetch 제거).
  const spot = await getSpotById(id);
  if (!spot) notFound();

  const gradient = categoryGradient[spot.category] ?? categoryGradient.other;

  return (
    <div className="flex flex-col min-h-screen bg-background">

      {/* 히어로 */}
      <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-muted">
        {spot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover" />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-br", gradient)} />
        )}
        {/* 하단 페이드 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* 뒤로 가기 */}
        <Link
          href="/spots"
          className="absolute top-5 left-5 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-sm font-medium px-3 py-1.5 rounded-full text-foreground hover:bg-background transition-colors shadow-sm"
        >
          ← 목록으로
        </Link>

        {/* 히어로 배지들 */}
        <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
          <span className="bg-background/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-foreground shadow-sm">
            {categoryLabel[spot.category]}
          </span>
          {isBarrierFree(spot.barrierFree) && (
            <span className="bg-good text-xs font-semibold px-3 py-1 rounded-full text-on-good shadow-sm">
              무장애
            </span>
          )}
          {spot.congestion && (
            <span className={cn("flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full shadow-sm", congestionStyle[spot.congestion].text)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", congestionStyle[spot.congestion].dot)} />
              예상 {congestionLabel(spot.congestion)}
            </span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* 왼쪽: 주요 정보 */}
          <div className="lg:col-span-2 space-y-6">

            {/* 제목 + 주소 */}
            <div>
              <h1 className="text-3xl font-bold text-foreground leading-tight">{spot.name}</h1>
              <p className="text-foreground/60 mt-1.5 text-sm">{spot.address}</p>
            </div>

            {/* 설명 */}
            {spot.description && (
              <p className="text-foreground/80 leading-relaxed text-sm border-l-4 border-primary/30 pl-4">
                {spot.description}
              </p>
            )}

            {/* 핵심 스펙 */}
            <div>
              <h2 className="text-sm font-bold text-foreground/40 uppercase tracking-widest mb-3">작업 환경</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SpecCard
                  label="WiFi"
                  value={spot.wifi.available === null ? "정보 없음" : spot.wifi.available ? "있음" : "없음"}
                  available={spot.wifi.available}
                  accentColor="primary"
                />
                <SpecCard
                  label="콘센트"
                  value={spot.power.level ?? "정보 없음"}
                  available={spot.power.level === null ? null : spot.power.level !== "없음"}
                  accentColor="accent"
                />
                <SpecCard
                  label="영업 시간"
                  value={spot.openHours}
                  available={true}
                  accentColor="border"
                />
                <div className="bg-background border border-border rounded-2xl p-4">
                  <p className="text-xs text-foreground/40 mb-2">소음도</p>
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", spot.noise !== "언급없음" ? noiseBadge[spot.noise] : "bg-muted text-foreground/60")}>
                    {noiseLabel(spot.noise)}
                  </span>
                </div>
                {spot.congestion && (
                  <div className="bg-background border border-border rounded-2xl p-4">
                    <p className="text-xs text-foreground/40 mb-2">예상 혼잡도</p>
                    <span className={cn("flex items-center gap-1.5 text-xs font-semibold w-fit px-2.5 py-1 rounded-full", congestionStyle[spot.congestion].text)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", congestionStyle[spot.congestion].dot)} />
                      {congestionLabel(spot.congestion)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 무장애 편의시설 */}
            {spot.barrierFree !== undefined && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-primary mb-3">무장애 편의시설</h2>
                <div className="flex flex-wrap gap-2">
                  {BARRIER_FREE_FIELDS.map(({ key, label }) => {
                    const available = spot.barrierFree?.[key];
                    return (
                      <span
                        key={key}
                        className={cn(
                          "text-xs px-3 py-1 rounded-full font-semibold",
                          available ? "bg-good text-on-good" : "bg-muted text-foreground/40 line-through"
                        )}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 태그 */}
            <div className="flex flex-wrap gap-2">
              {spot.tags.map((tag) => (
                <span key={tag} className="text-xs text-foreground/60 bg-background border border-border px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-4">
            <WorkEnvScore spot={spot} />

            {/* 지도 자리 */}
            <div className="bg-muted border border-border rounded-2xl h-44 flex flex-col items-center justify-center gap-1 text-foreground/40">
              <div className="w-8 h-8 rounded-full border-2 border-border flex items-center justify-center text-foreground/40 font-bold text-sm">
                지
              </div>
              <p className="text-xs text-foreground/40">지도 준비 중</p>
            </div>

            {/* AI 큐레이터 CTA — 라이트/다크 공용 짙은 톤 (홈페이지 히어로와 동일 패턴) */}
            <Link
              href="/ai-curator"
              className="block w-full text-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] text-white py-3.5 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg"
            >
              AI로 동선 짜기
            </Link>

            {/* 목록으로 */}
            <Link
              href="/spots"
              className="block w-full text-center text-foreground/60 text-sm font-medium py-2.5 rounded-2xl border border-border hover:border-foreground/40 hover:text-foreground transition-all"
            >
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecCard({
  label, value, available, accentColor,
}: {
  label: string;
  value: string;
  available: boolean | null;
  accentColor: "primary" | "accent" | "border";
}) {
  const accent = {
    primary: "border-l-primary",
    accent: "border-l-accent",
    border: "border-l-border",
  }[accentColor];

  return (
    <div className={cn(
      "bg-background border border-border rounded-2xl p-4 border-l-4",
      available ? accent : "border-l-border opacity-60"
    )}>
      <p className="text-xs text-foreground/40 mb-1">{label}</p>
      <p className={cn("text-sm font-bold", available ? "text-foreground" : "text-foreground/40")}>
        {value}
      </p>
    </div>
  );
}
