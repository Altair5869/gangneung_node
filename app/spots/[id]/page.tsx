import { notFound } from "next/navigation";
import Link from "next/link";
import { noiseLabel, congestionLabel, cn, isBarrierFree } from "@/lib/utils";
import WorkEnvScore from "@/components/spots/WorkEnvScore";
import { categoryLabel, categoryGradient, noiseBadge, congestionStyle, BARRIER_FREE_FIELDS } from "@/lib/spot-visuals";
import { getSpotById } from "@/lib/spot-detail";
import { auth } from "@/auth";
import { getUserCheckin } from "@/lib/community-checkin";
import CommunityBadge from "@/components/checkin/CommunityBadge";
import CheckinForm from "@/components/checkin/CheckinForm";

export const dynamic = "force-dynamic";

export default async function SpotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  // 지도(/map)의 워크스팟 패널에서 "상세 페이지 열기"로 들어오면 from=map이 붙는다. 그때는
  // 뒤로가기가 목록(/spots)이 아니라 지도로 돌아가야 한다 — 예전에는 진입 경로와 무관하게 항상
  // /spots로 보내서, 지도에서 들어온 사용자가 화면 내 경로로 지도로 못 돌아갔다(요구사항 2-2).
  // searchParams는 Next 16에서 Promise다(node_modules/next/dist/docs .../page.md 확인).
  const from = (await searchParams).from;
  const cameFromMap = from === "map";
  // /api/spots/[id] 라우트와 동일한 조회·병합 함수를 직접 호출한다(셀프 fetch 제거).
  const spot = await getSpotById(id);
  if (!spot) notFound();

  // 커뮤니티 체크인(2026-08-11 신규): 로그인 상태일 때만 본인의 최신 체크인을 조회한다.
  // 세션은 요청 컨텍스트에 종속적이라 getSpotById(spot 조회+커뮤니티 요약 병합)와는 별도로
  // 이 페이지가 직접 auth()를 호출한다 — /api/spots/[id] 라우트도 동일한 패턴을 쓴다.
  const session = await auth();
  const myCheckin = session?.user?.id ? await getUserCheckin(id, session.user.id) : null;

  const gradient = categoryGradient[spot.category] ?? categoryGradient.other;

  return (
    <div className="flex flex-col min-h-screen bg-background">

      {/* 히어로 */}
      <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-muted">
        {spot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover" />
        ) : (
          // imageUrl이 없을 때(예: 카카오 유래 kakao-* 스팟은 imageUrl: "") 그라데이션만 깔리면
          // 이미지 로딩 실패처럼 보인다. 의도된 플레이스홀더임이 드러나게 아이콘+문구를 얹되,
          // 없는 사진을 스톡 이미지로 지어내지 않는다(요구사항 4-1, 4-3). 뒤로가기(top-5)·하단
          // 배지(bottom-5)와 겹치지 않도록 세로 중앙에만 배치한다(4-2).
          <div className={cn("w-full h-full bg-gradient-to-br flex flex-col items-center justify-center gap-2 px-6", gradient)}>
            <svg
              className="w-9 h-9 text-white/70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16l5-5 4 4 3-3 6 6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
            </svg>
            <p className="text-sm font-semibold text-white/85 text-center line-clamp-1">{spot.name}</p>
            <p className="text-xs text-white/70">{categoryLabel[spot.category]} · 등록된 사진 없음</p>
          </div>
        )}
        {/* 하단 페이드 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* 뒤로 가기 — 진입 경로(from=map)에 따라 목적지와 문구가 함께 바뀐다. */}
        <Link
          href={cameFromMap ? "/map" : "/spots"}
          className="absolute top-5 left-5 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-sm font-medium px-3 py-1.5 rounded-full text-foreground hover:bg-background transition-colors shadow-sm"
        >
          {cameFromMap ? "← 지도로" : "← 목록으로"}
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

            {/* 커뮤니티 확인 배지 (R7-1) — VERIFIED_SPOTS(실측) 배지와 다른 스타일(점선 테두리) */}
            <div>
              <h2 className="text-sm font-bold text-foreground/40 uppercase tracking-widest mb-3">커뮤니티 검증</h2>
              <CommunityBadge summary={spot.communityCheckin} variant="full" />
            </div>
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-4">
            <WorkEnvScore spot={spot} />

            {/* 체크인하기 (R2, R7-2) */}
            <CheckinForm spotId={spot.id} myCheckin={myCheckin} />

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

            {/* 지도/목록으로 — 히어로 뒤로가기와 별개로, 본문 하단에서도 지도로 돌아갈 경로를
                항상 제공한다(진입 경로가 무엇이든 화면 내 경로로 /map에 닿을 수 있어야 한다). */}
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/map"
                className="block w-full text-center text-foreground/60 text-sm font-medium py-2.5 rounded-2xl border border-border hover:border-foreground/40 hover:text-foreground transition-all"
              >
                지도로
              </Link>
              <Link
                href="/spots"
                className="block w-full text-center text-foreground/60 text-sm font-medium py-2.5 rounded-2xl border border-border hover:border-foreground/40 hover:text-foreground transition-all"
              >
                목록으로
              </Link>
            </div>
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
