"""
fetch_candidates.py로 뽑은 CSV에서 30~50곳을 직접 골라 contentid만 남긴 파일을 만들고,
그 파일을 입력으로 받아 detailCommon2에서 overview 필드를 가져온다.
동시에 워케이션 특화 필드(wifi_real, power_real, noise_real, workation_note)를
직접 채워넣을 빈 컬럼도 같이 만든다.

사용법:
    1. selected_ids.csv 파일을 만든다 (컬럼: contentid 하나만, 30~50줄)
    2. python fetch_overview.py --ids selected_ids.csv --out spots_enriched.csv
    3. spots_enriched.csv를 열어서 wifi_real / power_real / noise_real / workation_note 컬럼을 직접 채운다
"""

import argparse
import csv
import sys
import time
from pathlib import Path

import requests

KORSERVICE_URL = "https://apis.data.go.kr/B551011/KorService2/detailCommon2"


def load_service_key(env_path: Path) -> str:
    if not env_path.exists():
        print(f"에러: {env_path} 파일을 찾을 수 없습니다.", file=sys.stderr)
        sys.exit(1)
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("TOURISM_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("에러: .env.local에서 TOURISM_API_KEY를 찾을 수 없습니다.", file=sys.stderr)
    sys.exit(1)


def fetch_overview(service_key: str, content_id: str) -> dict:
    params = {
        "serviceKey": service_key,
        "MobileOS": "ETC",
        "MobileApp": "GangneungNode",
        "_type": "json",
        "contentId": content_id,
    }
    res = requests.get(KORSERVICE_URL, params=params, timeout=10)
    if res.status_code != 200:
        print(f"경고: contentId {content_id} 요청 실패 ({res.status_code})", file=sys.stderr)
        return {}

    data = res.json()
    body = data.get("response", {}).get("body", {})
    items_wrap = body.get("items", "")
    if not items_wrap or isinstance(items_wrap, str):
        return {}

    item = items_wrap.get("item", [])
    if isinstance(item, list):
        item = item[0] if item else {}

    return item


def read_selected_ids(path: Path) -> list:
    with path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [row["contentid"].strip() for row in reader if row.get("contentid", "").strip()]


def main():
    parser = argparse.ArgumentParser(description="선택된 contentId로 overview 필드 추출")
    parser.add_argument("--ids", required=True, help="contentid 컬럼 하나짜리 CSV 경로")
    parser.add_argument("--out", required=True, help="출력 CSV 경로")
    parser.add_argument("--env", default="../gangneung-node/.env.local", help=".env.local 경로")
    args = parser.parse_args()

    service_key = load_service_key(Path(args.env))
    content_ids = read_selected_ids(Path(args.ids))

    if not content_ids:
        print("에러: 선택된 contentId가 없습니다.", file=sys.stderr)
        sys.exit(1)

    rows = []
    for i, cid in enumerate(content_ids, 1):
        item = fetch_overview(service_key, cid)
        rows.append({
            "contentid": cid,
            "title": item.get("title", ""),
            "addr1": item.get("addr1", ""),
            "overview": item.get("overview", "").replace("\n", " ").strip(),
            # wifi_real / power_real은 전화 확인·직접 방문으로 채우는 사실 기반 값.
            # noise_signal은 네이버 검색 API 결과로 채우는 신호 기반 값 (전화로 검증 불가능).
            "wifi_real": "",       # true / false / 모름
            "power_real": "",      # true / false / 모름
            "noise_signal": "",    # 언급됨-조용함 / 언급됨-시끄러움 / 언급없음
            "workation_note": "",  # 직접 작성하는 워케이션 특화 1~2문장
        })
        print(f"[{i}/{len(content_ids)}] {cid} 처리 완료")
        time.sleep(0.3)

    out_path = Path(args.out)
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "contentid", "title", "addr1", "overview",
            "wifi_real", "power_real", "noise_signal", "workation_note",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"완료: {len(rows)}건을 {out_path}에 저장했습니다.")
    print("wifi_real / power_real / noise_real / workation_note 컬럼을 직접 채워넣으세요.")


if __name__ == "__main__":
    main()
