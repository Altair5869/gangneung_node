import { ReactNode } from "react";
import { cn } from "@/lib/utils";

// MapSpotCard/MapLifeSpotCard 공용 레이아웃 래퍼(요구사항 문서 3번, AC1~AC4). 두 카드가 각자
// 중복 정의하던 위치·크기 클래스(`absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)]
// max-w-sm ...`)를 여기 하나로 모으고, 데스크톱(md: 768px~)에서는 우측 사이드패널로 전환한다
// (설계 판단 1/3). 이 컴포넌트는 위치/크기/반응형/헤더(제목·카테고리·닫기 X)만 담당하고,
// 카드별 데이터 로직(폴백 문구, undefined/null 처리, wifi/power/noise 조건부 렌더링)은 절대
// 건드리지 않는다 — children으로 그대로 흘려보낸다.
export default function MapDetailPanel({
  title,
  category,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  category?: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute z-10 bg-background border border-border overflow-hidden flex flex-col",
        // 모바일(md: 미만) 폴백 — 기존 하단 시트 위치/크기 그대로 유지(설계 판단 3, AC3).
        "bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm max-h-[70vh] rounded-2xl shadow-xl",
        // 데스크톱(md: 768px~) — 우측 사이드패널, 지도 전체 높이(설계 판단 3, AC1).
        "md:top-0 md:bottom-0 md:right-0 md:left-auto md:translate-x-0 md:h-full md:max-h-full md:w-96 md:max-w-none md:rounded-none md:rounded-l-2xl md:shadow-2xl md:border-y-0 md:border-r-0"
      )}
    >
      <div className="flex items-start justify-between p-4 pb-3 shrink-0">
        <div className="min-w-0">
          {category}
          <h3 className="font-bold text-foreground text-base">{title}</h3>
          {subtitle}
        </div>
        <button
          onClick={onClose}
          className="text-foreground/50 hover:text-foreground transition-colors ml-2 mt-0.5 shrink-0"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
      <div className="overflow-y-auto flex-1">{children}</div>
    </div>
  );
}
