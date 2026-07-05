"""
강릉 지역 관광공사 API 후보 스팟 목록을 가져와서 CSV로 저장한다.
gangneung-node/.env.local의 TOURISM_API_KEY를 그대로 읽어서 쓴다.

사용법:
    python fetch_candidates.py --content-type 12 --out candidates_attraction.csv
    python fetch_candidates.py --content-type 32 --out candidates_stay.csv

contentTypeId 참고값 (관광공사 TourAPI 기준):
    12 = 관광지
    14 = 문화시설
    32 = 숙박
    39 = 음식점
"""

import argparse
import csv
import os
import sys
import time
from pathlib import Path

import requests

KORSERVICE_URL = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2"


def load_service_key(env_path: Path) -> str:
    """.env.local에서 TOURISM_API_KEY 값만 직접 파싱한다. 외부 의존성(dotenv) 없이 처리."""
    if not env_path.exists():
        print(f"에러: {env_path} 파일을 찾을 수 없습니다.", file=sys.stderr)
        sys.exit(1)

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("TOURISM_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")

    print("에러: .env.local에서 TOURISM_API_KEY를 찾을 수 없습니다.", file=sys.stderr)
    sys.exit(1)


def fetch_area_based_list(service_key: str, content_type_id: str, area_code: str, sigungu_code: str):
    """areaBasedList2 엔드포인트를 페이지네이션하며 전체 항목을 가져온다."""
    all_items = []
    page_no = 1
    num_of_rows = 50

    while True:
        params = {
            "serviceKey": service_key,
            "MobileOS": "ETC",
            "MobileApp": "GangneungNode",
            "_type": "json",
            "areaCode": area_code,
            "sigunguCode": sigungu_code,
            "contentTypeId": content_type_id,
            "numOfRows": str(num_of_rows),
            "pageNo": str(page_no),
        }
        res = requests.get(KORSERVICE_URL, params=params, timeout=10)
        if res.status_code != 200:
            print(f"에러: API 응답 {res.status_code} — {res.text[:300]}", file=sys.stderr)
            sys.exit(1)

        data = res.json()
        body = data.get("response", {}).get("body", {})
        items_wrap = body.get("items", "")
        if not items_wrap or isinstance(items_wrap, str):
            break

        item = items_wrap.get("item", [])
        items = item if isinstance(item, list) else [item]
        if not items:
            break

        all_items.extend(items)

        total_count = int(body.get("totalCount", 0))
        if page_no * num_of_rows >= total_count:
            break

        page_no += 1
        time.sleep(0.3)  # 공공데이터포털 호출 간격 확보

    return all_items


def main():
    parser = argparse.ArgumentParser(description="관광공사 API 강릉 후보 스팟 목록 추출")
    parser.add_argument("--content-type", required=True, help="contentTypeId (예: 12=관광지, 32=숙박, 39=음식점)")
    parser.add_argument("--area-code", default="32", help="기본값 32 (강원도)")
    parser.add_argument("--sigungu-code", default="1", help="기본값 1 (강릉시)")
    parser.add_argument("--out", required=True, help="출력 CSV 파일 경로")
    parser.add_argument("--env", default="../gangneung-node/.env.local", help=".env.local 경로")
    args = parser.parse_args()

    service_key = load_service_key(Path(args.env))
    items = fetch_area_based_list(service_key, args.content_type, args.area_code, args.sigungu_code)

    if not items:
        print("결과 없음. contentTypeId나 지역 코드를 확인하세요.", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out)
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["contentid", "title", "addr1", "addr2", "mapx", "mapy", "firstimage"])
        for it in items:
            writer.writerow([
                it.get("contentid", ""),
                it.get("title", ""),
                it.get("addr1", ""),
                it.get("addr2", ""),
                it.get("mapx", ""),
                it.get("mapy", ""),
                it.get("firstimage", ""),
            ])

    print(f"완료: {len(items)}건을 {out_path}에 저장했습니다.")


if __name__ == "__main__":
    main()
