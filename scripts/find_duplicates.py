"""
filtered.csv에서 중복 항목을 제거한다.

중복 판정 2단계:
  1. contentid 동일 → 완전 중복 (먼저 나온 것 유지)
  2. 정규화 이름 동일 + 좌표 500m 이내 → 근사 중복 (먼저 나온 것 유지)

사용법:
    python find_duplicates.py --in filtered.csv --out filtered_deduped.csv
"""

import argparse
import csv
import math
import re
from difflib import SequenceMatcher
from pathlib import Path


def normalize(title: str) -> str:
    """공백·특수문자 제거 후 소문자화."""
    return re.sub(r"[\s\-_·,.]", "", title).lower()


def name_similarity(a: str, b: str) -> float:
    """정규화된 두 이름의 유사도(0~1). SequenceMatcher.ratio() 기준."""
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 간 거리(미터)."""
    R = 6_371_000
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def main():
    parser = argparse.ArgumentParser(description="워케이션 후보 CSV 중복 제거")
    parser.add_argument("--in", dest="input", required=True, help="입력 CSV")
    parser.add_argument("--out", required=True, help="출력 CSV (중복 제거본)")
    parser.add_argument("--proximity-m", type=float, default=500,
                        help="근사 중복 판정 거리 기준 (미터, 기본값 500)")
    parser.add_argument("--similarity", type=float, default=0.6,
                        help="근사 중복 판정 이름 유사도 기준 (0~1, 기본값 0.6)")
    args = parser.parse_args()

    rows = []
    with Path(args.input).open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    seen_ids: set[str] = set()
    kept: list[dict] = []
    dup_exact = 0
    dup_near = 0

    for row in rows:
        cid = row.get("contentid", "").strip()

        # 1단계: contentid 완전 중복
        if cid in seen_ids:
            dup_exact += 1
            continue
        seen_ids.add(cid)

        # 2단계: 이름+좌표 근사 중복
        try:
            lat = float(row.get("mapy", "") or 0)
            lng = float(row.get("mapx", "") or 0)
        except ValueError:
            lat, lng = 0.0, 0.0

        title = row.get("title", "")
        is_near_dup = False

        if lat and lng and title:
            for prev in kept:
                if name_similarity(title, prev.get("title", "")) < args.similarity:
                    continue
                try:
                    plat = float(prev.get("mapy", "") or 0)
                    plng = float(prev.get("mapx", "") or 0)
                except ValueError:
                    continue
                if plat and plng and haversine_m(lat, lng, plat, plng) <= args.proximity_m:
                    is_near_dup = True
                    break

        if is_near_dup:
            dup_near += 1
            continue

        kept.append(row)

    out_path = Path(args.out)
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(kept)

    total = len(rows)
    removed = dup_exact + dup_near
    print(f"입력 {total}건 → contentid 중복 {dup_exact}건, 근사 중복 {dup_near}건 제거 → {len(kept)}건을 {out_path}에 저장했습니다.")


if __name__ == "__main__":
    main()
