import { DetailIntroItem, DetailInfoItem } from "@/lib/tourism-api";
import { OperatingInfo } from "@/types";

// contentTypeId(12/14)에 따라 다른 원본 필드명(usetime/usetimeculture 등)을 하나의 내부
// 타입으로 정규화한다(요구사항 문서 6절). 빈 문자열("")은 null("정보 없음")로 취급하되,
// "연중무휴"/"상시 개방"/"무료" 같은 실제 API 원문 텍스트는 가공 없이 그대로 옮긴다 — 임의로
// "휴무 없음" 등으로 재해석하지 않는다(CLAUDE.md 3단 원칙과 동일 정신, AC5).
function emptyToNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

// contentTypeId=12는 introItem(detailIntro2) + infoItems(detailInfo2 결과)를 함께 받고,
// contentTypeId=14는 introItem만 받는다(infoItems는 호출부가 기본값 []로 둔다) — usefee가
// detailIntro2 응답 안에 이미 있어 detailInfo2를 부를 필요가 없기 때문(요구사항 문서 1-2절).
// introItem이 null(detailIntro2 실패/0건)이면 전체를 null로 반환해, 호출부(MapLifeSpotCard)가
// "운영 정보가 연동되지 않았어요" 폴백을 그리게 한다(AC6).
export function normalizeOperatingInfo(
  introItem: DetailIntroItem | null,
  contentTypeId: "12" | "14",
  infoItems: DetailInfoItem[] = []
): OperatingInfo | null {
  if (!introItem) return null;

  const hours =
    contentTypeId === "14" ? emptyToNull(introItem.usetimeculture) : emptyToNull(introItem.usetime);
  const closedDays =
    contentTypeId === "14" ? emptyToNull(introItem.restdateculture) : emptyToNull(introItem.restdate);
  // QA 실측(2026-08-18, 굴산사지 125769/contentTypeId=12): infoname이 항상 "입장료"로 정확히
  // 오지 않는다 — 음절 사이에 공백이 섞인 "입 장 료" 표기가 실제로 존재해 정확 일치 비교로는
  // infotext="무료"가 실존함에도 fee가 null("정보 없음")로 잘못 표시됐다(손실 방향 버그). 공백을
  // 모두 제거한 뒤 비교해 이런 표기 비일관성을 흡수한다 — infoname 자체를 재해석/추측하는 게
  // 아니라 관광공사 API가 실제로 보내는 여러 표기를 같은 항목으로 인식하기 위한 정규화다.
  const fee =
    contentTypeId === "14"
      ? emptyToNull(introItem.usefee)
      : emptyToNull(infoItems.find((i) => i.infoname?.replace(/\s+/g, "") === "입장료")?.infotext);

  return { hours, closedDays, fee };
}
