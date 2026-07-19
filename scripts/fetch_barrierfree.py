"""
verified_spots.json의 24곳(관광공사 contentId 보유 23곳)에 대해
관광공사 무장애 관광정보 API(KorWithService2/detailWithTour2)를 조회해
wheelchair/exit/elevator/restroom/parking 원문 데이터가 있는지 확인한다.

사용법:
    python fetch_barrierfree.py --ids verified_content_ids.csv --out barrierfree_raw.csv --env ../.env.local
"""

import argparse
import csv
import sys
import time
from pathlib import Path

import requests

BARRIER_FREE_URL = "https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2"


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


def fetch_barrierfree(service_key: str, content_id: str) -> dict:
    params = {
        "serviceKey": service_key,
        "MobileOS": "ETC",
        "MobileApp": "GangneungNode",
        "_type": "json",
        "contentId": content_id,
    }
    res = requests.get(BARRIER_FREE_URL, params=params, timeout=10)
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


def read_ids(path: Path) -> list:
    with path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [(row["contentid"].strip(), row["name"].strip()) for row in reader if row.get("contentid", "").strip()]


def main():
    parser = argparse.ArgumentParser(description="24곳 contentId로 무장애 API 원문 데이터 확인")
    parser.add_argument("--ids", required=True, help="contentid,name 컬럼 CSV 경로")
    parser.add_argument("--out", required=True, help="출력 CSV 경로")
    parser.add_argument("--env", default=".env.local", help=".env.local 경로")
    args = parser.parse_args()

    service_key = load_service_key(Path(args.env))
    id_name_pairs = read_ids(Path(args.ids))

    rows = []
    for i, (cid, name) in enumerate(id_name_pairs, 1):
        item = fetch_barrierfree(service_key, cid)
        has_data = bool(item)
        rows.append({
            "contentid": cid,
            "name": name,
            "has_data": has_data,
            "wheelchair": item.get("wheelchair", ""),
            "exit": item.get("exit", ""),
            "elevator": item.get("elevator", ""),
            "restroom": item.get("restroom", ""),
            "parking": item.get("parking", ""),
        })
        print(f"[{i}/{len(id_name_pairs)}] {name} ({cid}): 데이터 {'있음' if has_data else '없음'}")
        time.sleep(0.3)

    out_path = Path(args.out)
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "contentid", "name", "has_data", "wheelchair", "exit", "elevator", "restroom", "parking",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"완료: {len(rows)}건을 {out_path}에 저장했습니다.")


if __name__ == "__main__":
    main()
