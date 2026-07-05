"""
final_candidates.csv에 수동으로 추가한 selected 컬럼(Y/N)을 기준으로
선택된 30곳을 뽑아서 두 그룹으로 분리한다.

  - selected_ids_tourapi.csv: contentid가 숫자인 것 (카페, 호텔) → fetch_overview.py 입력용
  - selected_library.csv: contentid가 "kakao-"로 시작하는 것 (도서관) → overview 못 가져오므로 별도 처리

사용법:
    python extract_selected.py --in final_candidates.csv
"""

import argparse
import csv
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="selected=Y 항목을 분리 추출")
    parser.add_argument("--in", dest="input", required=True, help="selected 컬럼이 포함된 CSV")
    parser.add_argument("--out-dir", default=".", help="출력 폴더 (기본값: 현재 폴더)")
    args = parser.parse_args()

    with open(args.input, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    if "selected" not in rows[0]:
        print("에러: 'selected' 컬럼이 없습니다. Google Sheets에서 컬럼명이 정확히 'selected'인지 확인하세요.")
        return

    selected = [r for r in rows if r.get("selected", "").strip().upper() == "Y"]

    if not selected:
        print("에러: selected=Y인 행이 없습니다. Y가 대문자인지, 공백이 섞이지 않았는지 확인하세요.")
        return

    tourapi_rows = [r for r in selected if not r["contentid"].startswith("kakao-")]
    kakao_rows = [r for r in selected if r["contentid"].startswith("kakao-")]

    out_dir = Path(args.out_dir)

    tourapi_path = out_dir / "selected_ids_tourapi.csv"
    with tourapi_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["contentid"])
        for r in tourapi_rows:
            writer.writerow([r["contentid"]])

    library_path = out_dir / "selected_library.csv"
    with library_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["contentid", "title", "addr1", "category",
                                                "wifi_real", "power_real", "noise_real", "workation_note"])
        writer.writeheader()
        for r in kakao_rows:
            writer.writerow({
                "contentid": r["contentid"],
                "title": r["title"],
                "addr1": r["addr1"],
                "category": r["category"],
                "wifi_real": "",
                "power_real": "",
                "noise_real": "",
                "workation_note": "",
            })

    print(f"전체 선택 {len(selected)}건 (카페+호텔 {len(tourapi_rows)}건, 도서관 {len(kakao_rows)}건)")
    print(f"{tourapi_path} → fetch_overview.py의 --ids로 넘기세요")
    print(f"{library_path} → wifi_real/power_real/noise_real/workation_note 직접 채우세요")

    if len(selected) != 30:
        print(f"주의: 선택된 건수가 30이 아니라 {len(selected)}건입니다. Google Sheets에서 Y 표시를 다시 확인하세요.")


if __name__ == "__main__":
    main()
