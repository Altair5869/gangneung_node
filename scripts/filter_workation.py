"""
app/api/spots/route.ts의 WORKATION_KEYWORDS, isWorkationSpot 로직을 그대로 옮긴 필터.
후보 CSV 여러 개를 합쳐서 워케이션 관련 이름만 남기고, 결과를 하나의 CSV로 합친다.

TypeScript 원본과 다르게 관리하면 나중에 둘이 어긋난다.
TS 쪽 WORKATION_KEYWORDS가 바뀌면 이 파일의 WORKATION_KEYWORDS도 같이 바꿔야 한다.

사용법:
    python filter_workation.py --in candidates_food.csv candidates_culture.csv candidates_stay.csv --out filtered.csv
"""

import argparse
import csv
from pathlib import Path

# app/api/spots/route.ts의 WORKATION_KEYWORDS와 반드시 동일하게 유지
WORKATION_KEYWORDS = [
    "카페", "커피", "coffee", "cafe",
    "코워킹", "공유오피스", "스터디",
    "도서관", "library",
    "라운지", "lounge",
    "호텔", "hotel", "리조트",
    "브루어리", "베이커리",
]


def is_workation_spot(name: str) -> bool:
    lower = name.lower()
    return any(kw.lower() in lower for kw in WORKATION_KEYWORDS)


def main():
    parser = argparse.ArgumentParser(description="워케이션 키워드로 후보 CSV 필터링")
    parser.add_argument("--in", dest="inputs", nargs="+", required=True, help="입력 CSV 파일들 (contentid,title,... 컬럼 포함)")
    parser.add_argument("--out", required=True, help="출력 CSV 경로")
    args = parser.parse_args()

    matched = []
    total = 0
    for input_path in args.inputs:
        path = Path(input_path)
        with path.open(encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total += 1
                title = row.get("title", "")
                if is_workation_spot(title):
                    row["source_file"] = path.name
                    matched.append(row)

    if not matched:
        print("필터를 통과한 항목이 없습니다. WORKATION_KEYWORDS나 입력 파일을 확인하세요.")
        return

    fieldnames = list(matched[0].keys())
    out_path = Path(args.out)
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(matched)

    print(f"전체 {total}건 중 {len(matched)}건 통과 → {out_path}에 저장했습니다.")


if __name__ == "__main__":
    main()
