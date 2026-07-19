"""
spots_enriched.csv + selected_library.csv(실측 wifi/power/noise 확정본)를
candidates_*.csv(mapx/mapy 보유)와 contentid 기준으로 조인해서,
Next.js 앱이 그대로 import할 수 있는 WorkSpot[] 형태의 JSON을 만든다.

이 24곳은 전화 확인/방문/웹 스크리닝으로 wifi·power·noise를 실측한
공모전 제출용 확정 스팟이라, 관광공사 API가 응답을 못 주는 날에도
항상 앱에 표시되어야 한다 (app/api/spots/route.ts에서 우선 병합).

사용법:
    python build_verified_spots.py --out data/verified_spots.json
"""

import argparse
import csv
import json
import sys
from pathlib import Path

CANDIDATE_FILES = [
    "candidates_food.csv",
    "candidates_stay.csv",
    "candidates_culture.csv",
    "candidates_attraction.csv",
    "candidates_library.csv",
]

POWER_MAP = {
    "충분함": "충분함",
    "넉넉함": "충분함",
    "제한적": "제한적",
    "적음": "제한적",
    "없음": "없음",
}

BARRIER_FIELDS = ["wheelchair", "exit", "elevator", "restroom", "parking"]


def parse_barrier_field(val: str) -> bool:
    val = (val or "").strip()
    return val not in ("", "0", "없음", "불가")


def load_barrierfree_index(data_dir: Path) -> dict:
    path = data_dir / "barrierfree_raw.csv"
    index = {}
    if not path.exists():
        return index
    with path.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            cid = row.get("contentid", "").strip()
            if not cid or row.get("has_data", "").strip() != "True":
                continue
            index[cid] = {field: parse_barrier_field(row.get(field, "")) for field in BARRIER_FIELDS}
    return index


def infer_category(title: str) -> str:
    t = title.lower()
    if any(k in t for k in ["카페", "커피", "coffee", "브루어리"]):
        return "cafe"
    if any(k in t for k in ["코워킹", "공유오피스", "스터디"]):
        return "coworking"
    if any(k in t for k in ["도서관", "library"]):
        return "library"
    if any(k in t for k in ["호텔", "리조트", "hotel"]):
        return "hotel"
    return "cafe"


CATEGORY_TAG = {"cafe": "카페", "coworking": "코워킹", "library": "도서관", "hotel": "호텔", "other": "기타"}


def load_latlng_index(data_dir: Path) -> dict:
    index = {}
    for fname in CANDIDATE_FILES:
        path = data_dir / fname
        if not path.exists():
            continue
        with path.open(encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                cid = row.get("contentid", "").strip()
                mapx = row.get("mapx", "").strip()
                mapy = row.get("mapy", "").strip()
                if cid and mapx and mapy:
                    index[cid] = (mapx, mapy)
    return index


def build_spot(row: dict, latlng_index: dict, barrierfree_index: dict) -> dict:
    cid = row["contentid"].strip()
    title = row["title"].strip()
    category = infer_category(title)

    latlng = latlng_index.get(cid)
    if latlng is None:
        print(f"경고: {cid} ({title})의 위경도를 candidates_*.csv에서 찾지 못했습니다. 건너뜁니다.", file=sys.stderr)
        return None
    lat, lng = float(latlng[1]), float(latlng[0])

    power_raw = row.get("power_real", "").strip()
    power_level = POWER_MAP.get(power_raw)
    if power_raw and power_level is None:
        print(f"경고: {cid} ({title})의 power_real 값 '{power_raw}'을 매핑할 수 없습니다. null 처리합니다.", file=sys.stderr)

    noise_raw = row.get("noise_signal", "").strip()
    noise = noise_raw if noise_raw in ("언급됨-조용함", "언급됨-시끄러움") else "언급없음"

    wifi_raw = row.get("wifi_real", "").strip().lower()
    wifi_available = True if wifi_raw == "true" else (False if wifi_raw == "false" else None)

    is_library_source = cid.startswith("kakao-")
    spot_id = f"verified-{cid}" if is_library_source else f"tourism-{cid}"

    spot = {
        "id": spot_id,
        "name": title,
        "category": category,
        "address": row.get("addr1", "").strip(),
        "lat": lat,
        "lng": lng,
        "wifi": {"available": wifi_available},
        "power": {"level": power_level},
        "noise": noise,
        "openHours": "정보 미제공",
        "tags": [CATEGORY_TAG[category], "실측확인"],
        "tourismContentId": cid,
        "description": row.get("overview", "").strip() or None,
    }

    barrier_free = barrierfree_index.get(cid)
    if barrier_free is not None:
        spot["barrierFree"] = barrier_free

    return spot


def main():
    parser = argparse.ArgumentParser(description="실측 완료 24곳을 WorkSpot JSON으로 빌드")
    parser.add_argument("--data-dir", default=".", help="CSV들이 있는 폴더 (기본값: 현재 폴더)")
    parser.add_argument("--out", required=True, help="출력 JSON 경로")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    latlng_index = load_latlng_index(data_dir)
    barrierfree_index = load_barrierfree_index(data_dir)

    rows = []
    with (data_dir / "spots_enriched.csv").open(encoding="utf-8-sig") as f:
        rows.extend(csv.DictReader(f))
    with (data_dir / "selected_library.csv").open(encoding="utf-8-sig") as f:
        rows.extend(csv.DictReader(f))

    spots = [s for s in (build_spot(r, latlng_index, barrierfree_index) for r in rows) if s is not None]

    out_path = Path(args.out)
    out_path.write_text(json.dumps(spots, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"완료: {len(spots)}곳을 {out_path}에 저장했습니다. (입력 {len(rows)}곳)")


if __name__ == "__main__":
    main()
