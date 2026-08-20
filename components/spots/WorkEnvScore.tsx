import { WorkSpot } from "@/types";
import { cn } from "@/lib/utils";
import { calcWorkEnvScore } from "@/lib/work-env-score";

function scoreColor(score: number) {
  if (score >= 80) return { bar: "bg-good",  text: "text-good",  ring: "bg-good/10 border-good/30" };
  if (score >= 60) return { bar: "bg-primary", text: "text-primary", ring: "bg-primary/10 border-primary/30" };
  if (score >= 40) return { bar: "bg-warn",  text: "text-warn",  ring: "bg-warn/10 border-warn/30" };
  return               { bar: "bg-bad",   text: "text-bad",   ring: "bg-bad/10 border-bad/30" };
}

// 체크 항목은 확정 true/false 뿐 아니라 "미확인"(null)도 가질 수 있다. null을 false로 뭉개면
// "확정된 없음"처럼 보이므로 배지 아이콘/색을 3단계로 분리한다. 어떤 항목이 어느 상태가 되는지는
// lib/work-env-score.ts가 단독으로 판단한다 — 이 컴포넌트는 표시만 한다.
function checkVisual(state: boolean | null) {
  if (state === true) return { badge: "bg-good text-on-good", icon: "✓", text: "text-foreground" };
  if (state === false) return { badge: "bg-bad/15 text-bad", icon: "✗", text: "text-foreground/60" };
  return { badge: "bg-muted text-foreground/60 border border-border", icon: "–", text: "text-foreground/60 italic" };
}

export default function WorkEnvScore({ spot }: { spot: WorkSpot }) {
  const { criteria, confirmedCount, totalCount, score, label } = calcWorkEnvScore(spot);

  return (
    <div className="bg-background border border-border rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-bold text-foreground/40 uppercase tracking-widest">작업 환경 점수</h2>

      {/* 점수 — 확인된 항목이 0개면 숫자/등급 라벨을 아예 만들지 않는다(0점·"낮음"·빨강 금지).
          "정보가 없음"을 "환경이 나쁨"으로 보이게 하는 표기가 이 프로젝트의 데이터 규칙 위반이다. */}
      {score === null ? (
        <div className="rounded-xl px-4 py-3 border border-border bg-muted">
          <p className="text-sm font-bold text-foreground/70">정보 부족 — 판정 불가</p>
          <p className="text-xs text-foreground/50 mt-1">
            WiFi·콘센트·소음 중 확인된 항목이 없어 점수를 계산하지 않았어요.
          </p>
        </div>
      ) : (
        <>
          {/* 고정 만점 표기("/ 90점")는 삭제했다(요구사항 3-2) — 분모가 "확인된 항목의 배점
              합"이라 스팟마다 다르므로, 고정 만점을 적으면 거짓 정보가 된다. 대신 아래에
              "확인된 N/M개 항목 기준"을 항상 노출한다. */}
          <div className={cn("flex items-center justify-between rounded-xl px-4 py-3 border", scoreColor(score).ring)}>
            <span className={cn("text-4xl font-bold", scoreColor(score).text)}>{score}</span>
            <p className={cn("text-lg font-bold", scoreColor(score).text)}>{label}</p>
          </div>

          {/* 점수 바 */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn("h-2 rounded-full transition-all duration-500", scoreColor(score).bar)}
              style={{ width: `${score}%` }}
            />
          </div>

          {/* 분모가 "확인된 항목의 배점 합"이라는 사실을 화면에 명시한다(요구사항 3-2). */}
          <p className="text-xs text-foreground/50">
            확인된 {confirmedCount}/{totalCount}개 항목 기준
          </p>
        </>
      )}

      {/* 체크리스트 */}
      <ul className="space-y-2">
        {criteria.map((c) => {
          const v = checkVisual(c.state);
          return (
            <li key={c.key} className="flex items-center gap-2.5 text-sm">
              <span className={cn(
                "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold",
                v.badge
              )}>
                {v.icon}
              </span>
              <span className={v.text}>
                {c.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
