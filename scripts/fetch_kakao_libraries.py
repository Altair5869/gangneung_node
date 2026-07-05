"""
lib/kakao-local-api.ts의 CENTERS, KAKAO_REST_API_KEY를 그대로 재사용해서
"도서관" 키워드로 강릉 지역 검색 결과를 가져온다.
카테고리 코드(CE7=카페)가 아니라 키워드 검색이므로 category.json이 아니라 keyword.json을 쓴다.

사용법:
    python fetch_kakao_libraries.py --out candidates_library.csv
"""

import argparse
import csv
import sys
import time
from pathlib import Path

import requests

# lib/kakao-local-api.ts의 CENTERS와 동일하게 유지
CENTERS = [
    {"x": "128.8759", "y": "37.7519"},  # 강릉 시내/역
    {"x": "128.9170", "y": "37.7956"},  # 경포대/강문해변
    {"x": "128.8218", "y": "37.8981"},  # 주문진
    {"x": "128.8500", "y": "37.8300"},  # 사천
    {"x": "129.0500", "y": "37.6800"},  # 정동진
]
RADIUS = 6000
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


def load_rest_api_key(env_path: Path) -> str:
    if not env_path.exists():
        print(f"에러: {env_path} 파일을 찾을 수 없습니다.", file=sys.stderr)
        sys.exit(1)
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("KAKAO_REST_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("에러: .env.local에서 KAKAO_REST_API_KEY를 찾을 수 없습니다.", file=sys.stderr)
    sys.exit(1)


def search_keyword(api_key: str, query: str, x: str, y: str) -> list:
    headers = {"Authorization": f"KakaoAK {api_key}"}
    params = {"query": query, "x": x, "y": y, "radius": RADIUS, "size": 15}
    res = requests.get(KEYWORD_URL, headers=headers, params=params, timeout=10)
    if res.status_code != 200:
        print(f"경고: 요청 실패 ({res.status_code}) — {res.text[:200]}", file=sys.stderr)
        return []
    return res.json().get("documents", [])


def main():
    parser = argparse.ArgumentParser(description="카카오 로컬 API로 강릉 도서관 후보 검색")
    parser.add_argument("--query", default="도서관", help="검색 키워드 (기본값: 도서관)")
    parser.add_argument("--out", required=True)
    parser.add_argument("--env", default="../gangneung-node/.env.local")
    args = parser.parse_args()

    api_key = load_rest_api_key(Path(args.env))

    all_places = []
    seen_ids = set()
    for center in CENTERS:
        places = search_keyword(api_key, args.query, center["x"], center["y"])
        for p in places:
            if p["id"] in seen_ids:
                continue
            seen_ids.add(p["id"])
            all_places.append(p)
        time.sleep(0.3)

    if not all_places:
        print("결과 없음. 검색어를 바꾸거나 반경(RADIUS)을 늘려보세요.", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out)
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["contentid", "title", "addr1", "addr2", "mapx", "mapy", "firstimage"])
        for p in all_places:
            writer.writerow([
                f"kakao-{p['id']}",
                p.get("place_name", ""),
                p.get("road_address_name", "") or p.get("address_name", ""),
                "",
                p.get("x", ""),
                p.get("y", ""),
                "",
            ])

    print(f"완료: {len(all_places)}건을 {out_path}에 저장했습니다.")
    print("결과에 '도서관'이 이름에 없는 곳(전시관, 학원 등)이 섞여있을 수 있으니 직접 확인하세요.")


if __name__ == "__main__":
    main()
