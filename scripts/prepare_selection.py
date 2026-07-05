"""
filtered_deduped.csv를 카테고리(cafe/hotel/library)로 분류하고,
각 카테고리 안에서 우선순위 플래그를 붙여 정렬한다.
몇 곳을 최종 선택할지는 이 스크립트가 정하지 않는다 — 정렬된 목록에서 직접 고른다.

우선순위 기준:
  - 카페: 프랜차이즈(이디야, 컴포즈, 스타벅스 등)는 낮은 우선순위. 독립 카페가 리뷰 텍스트 다양성이 높음.
  - 호텔: "관광호텔"/"비즈니스"/"성급"/"리조트"/"스위트" 포함되면 높은 우선순위.
          이름만 "호텔"이고 실질은 모텔에 가까운 곳(정보 부족)은 낮은 우선순위.

사용법:
    python prepare_selection.py --spots filtered_deduped.csv --library candidates_library.csv --out final_candidates.csv
    (candidates_library.csv 없으면 --library 생략 가능)
"""

import argparse
import csv
from pathlib import Path

FRANCHISE_KEYWORDS = ["이디야", "스타벅스", "투썸", "메가커피", "컴포즈", "빽다방", "엔제리너스", "할리스"]
CAFE_KEYWORDS = ["카페", "커피", "coffee", "cafe", "베이커리", "브루어리", "라운지", "lounge"]
HOTEL_KEYWORDS = ["호텔", "hotel", "리조트"]
HOTEL_HIGH_PRIORITY_KEYWORDS = ["관광호텔", "비즈니스", "성급", "리조트", "스위트", "인피니티"]
LIBRARY_KEYWORDS = ["도서관", "library", "북카페", "책방", "문고", "책읽는방"]
RESTRICTED_ACCESS_KEYWORDS = ["아파트", "brenue", "브래뉴", "아이파크", "한내들", "꿈뜰", "LH", "대학교", "대학"]


def classify(title: str) -> str:
    t = title.lower()
    if any(k in t for k in [k.lower() for k in LIBRARY_KEYWORDS]):
        return "library"
    if any(k in t for k in [k.lower() for k in HOTEL_KEYWORDS]):
        return "hotel"
    if any(k in t for k in [k.lower() for k in CAFE_KEYWORDS]):
        return "cafe"
    return "other"


def priority_score(title: str, category: str) -> int:
    """낮을수록 우선순위 높음."""
    t = title.lower()
    if category == "cafe":
        if any(k in title for k in FRANCHISE_KEYWORDS):
            return 2
        return 1
    if category == "hotel":
        if any(k.lower() in t for k in HOTEL_HIGH_PRIORITY_KEYWORDS):
            return 1
        return 2
    return 1


def main():
    parser = argparse.ArgumentParser(description="카테고리 분류 및 우선순위 정렬")
    parser.add_argument("--spots", required=True, help="filtered_deduped.csv 경로")
    parser.add_argument("--library", default=None, help="candidates_library.csv 경로 (선택)")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    rows = []
    with open(args.spots, encoding="utf-8-sig") as f:
        rows.extend(csv.DictReader(f))

    if args.library and Path(args.library).exists():
        with open(args.library, encoding="utf-8-sig") as f:
            rows.extend(csv.DictReader(f))

    result = []
    for r in rows:
        title = r.get("title", "")
        category = classify(title)
        score = priority_score(title, category)
        is_franchise = category == "cafe" and any(k in title for k in FRANCHISE_KEYWORDS)
        access_restricted = category == "library" and any(k in title for k in RESTRICTED_ACCESS_KEYWORDS)
        result.append({
            "contentid": r.get("contentid", ""),
            "title": title,
            "addr1": r.get("addr1", ""),
            "category": category,
            "priority": score,
            "is_franchise": "Y" if is_franchise else "N",
            "access_restricted_suspect": "Y" if access_restricted else "N",
        })

    # 카테고리 순서(cafe -> hotel -> library -> other) → 우선순위 → 이름 순 정렬
    category_order = {"cafe": 0, "hotel": 1, "library": 2, "other": 3}
    result.sort(key=lambda r: (category_order.get(r["category"], 9), r["priority"], r["title"]))

    counts = {}
    for r in result:
        counts[r["category"]] = counts.get(r["category"], 0) + 1

    out_path = Path(args.out)
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["contentid", "title", "addr1", "category", "priority", "is_franchise", "access_restricted_suspect"])
        writer.writeheader()
        writer.writerows(result)

    print(f"전체 {len(result)}건 → {out_path}에 저장했습니다.")
    print("카테고리별 건수:", counts)
    print("priority=1인 항목을 우선적으로 최종 선택 목록에 넣으세요.")


if __name__ == "__main__":
    main()
