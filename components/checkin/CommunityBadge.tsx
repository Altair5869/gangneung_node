import { CommunityCheckinSummary } from "@/types";
import { cn } from "@/lib/utils";

interface CommunityBadgeProps {
  summary?: CommunityCheckinSummary;
  variant: "compact" | "full";
}

// VERIFIED_SPOTS(실측 24곳) 배지는 실선(bg-good 등 solid fill)을 쓴다. 이 배지는 항상
// 점선(dashed) 테두리만 써서, "확정 사실"이 아니라 "커뮤니티 신뢰도 계층"임을 시각적으로도
// 구분한다(R7-1, 데이터 규칙: 확정 아닌 걸 확정처럼 표기하지 않는다).
// confirmedAvailable/confirmedLevel이 null이면(정보 부족) "확인됨" 문구를 절대 쓰지 않는다.
export default function CommunityBadge({ summary, variant }: CommunityBadgeProps) {
  if (!summary) {
    if (variant === "full") {
      return (
        <p className="text-xs text-foreground/50 border border-dashed border-border rounded-2xl px-4 py-3">
          아직 커뮤니티 데이터가 부족해요. 첫 체크인을 남겨보세요.
        </p>
      );
    }
    return null; // 목록 카드는 체크인 0건 스팟에 배지 자체를 숨긴다(R7-5).
  }

  // confirmedAvailable === false는 "wifi 없음"이 커뮤니티로 확인된 대칭 배지(사용자 결정,
  // 2026-08-11). null은 정보 부족 — 둘을 구분해 절대 같은 문구를 쓰지 않는다.
  const wifiText =
    summary.wifi.confirmedAvailable === true
      ? "WiFi 있음 확인"
      : summary.wifi.confirmedAvailable === false
      ? "WiFi 없음 확인"
      : null;
  const powerText = summary.power.confirmedLevel ? `콘센트 ${summary.power.confirmedLevel} 확인` : null;

  if (variant === "compact") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium border border-dashed border-primary/40 text-primary/80">
        커뮤니티 {summary.totalCheckins}명 확인
      </span>
    );
  }

  return (
    <div className="border border-dashed border-primary/40 rounded-2xl p-4 space-y-2">
      <p className="text-xs font-bold text-primary/80">커뮤니티 확인됨 ({summary.totalCheckins}명 응답)</p>
      <div className="flex flex-wrap gap-2">
        <span
          className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium border border-dashed",
            wifiText ? "border-good/50 text-good" : "border-border text-foreground/50"
          )}
        >
          {wifiText ?? "WiFi 정보 부족"}
        </span>
        <span
          className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium border border-dashed",
            powerText ? "border-good/50 text-good" : "border-border text-foreground/50"
          )}
        >
          {powerText ?? "콘센트 정보 부족"}
        </span>
      </div>
    </div>
  );
}
