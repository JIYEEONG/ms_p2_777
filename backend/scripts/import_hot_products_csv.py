"""demand_report_v2.11의 10_hot_products_learned_recommendation.csv를
Postgres(taxi_products.hot_product_recommendations 테이블)에 적재한다.

사용법:
    cd ms_p2_777/backend
    python3 scripts/import_hot_products_csv.py \
        --csv "/Users/sonny/Desktop/260916_Moov_SSJALG_SSJ/demand_report_v2.11/output/10_hot_products_learned_recommendation.csv"

접속 정보는 backend/.env(POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB,
POSTGRES_USER, POSTGRES_PASSWORD, 필요시 POSTGRES_SSLMODE)를 읽는다.
--csv를 생략하면 아래 DEFAULT_CSV_PATH를 쓰는데, 이 프로젝트 CSV 파일이
다른 위치에 있다면 --csv로 직접 지정해야 한다.

재실행하면 그때마다 새 배치(generated_at=지금 시각)로 추가되고, API는 항상
가장 최근 배치만 돌려준다 — 예전 배치를 지우지는 않는다(이력 확인용으로 남김).
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

SCHEMA = "taxi_products"
TABLE = f"{SCHEMA}.hot_product_recommendations"

# 이 프로젝트(ms_p2_777)와 데이터 원본 프로젝트(260916_Moov_SSJALG_SSJ)가
# 둘 다 ~/Desktop 밑에 있다고 가정한 기본값. 다르면 --csv로 지정할 것.
DEFAULT_CSV_PATH = (
    Path.home()
    / "Desktop"
    / "260916_Moov_SSJALG_SSJ"
    / "demand_report_v2.11"
    / "output"
    / "10_hot_products_learned_recommendation.csv"
)

EXPECTED_COLUMNS = [
    "rank", "product_name", "image_filename",  # ← image_filename 추가
    "this_month_qty", "last_month_qty",
    "mom_growth_rate", "forecast_next_month_qty", "learned_growth_rate",
    "current_display_qty_per_vehicle", "recommended_additional_qty_raw",
    "recommended_additional_qty_learned", "notice",
]


def _to_int(value: str) -> int | None:
    value = (value or "").strip()
    return int(value) if value else None


def _to_numeric(value: str) -> float | None:
    value = (value or "").strip()
    return float(value) if value else None


def read_rows(csv_path: Path) -> list[dict]:
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in EXPECTED_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(
                f"CSV에 예상한 컬럼이 없습니다: {missing}\n"
                f"실제 컬럼: {reader.fieldnames}\n"
                "(v2.11 output/10_hot_products_learned_recommendation.csv가 맞는지 확인하세요)"
            )
        rows = []
        for raw in reader:
            rows.append({
                "rank": _to_int(raw["rank"]),
                "product_name": raw["product_name"].strip(),
                "image_filename": raw.get("image_filename", "").strip() or None,
                "this_month_qty": _to_int(raw["this_month_qty"]),
                "last_month_qty": _to_int(raw["last_month_qty"]),
                "mom_growth_rate": raw["mom_growth_rate"].strip() or None,
                "forecast_next_month_qty": _to_numeric(raw["forecast_next_month_qty"]),
                "learned_growth_rate": raw["learned_growth_rate"].strip() or None,
                "current_display_qty_per_vehicle": _to_int(raw["current_display_qty_per_vehicle"]),
                "recommended_additional_qty_raw": _to_int(raw["recommended_additional_qty_raw"]),
                "recommended_additional_qty_learned": _to_int(raw["recommended_additional_qty_learned"]),
                "notice": raw["notice"].strip() or None,
            })
        return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV_PATH, help="10_hot_products_learned_recommendation.csv 경로")
    parser.add_argument("--dry-run", action="store_true", help="DB에 쓰지 않고 CSV 파싱 결과만 출력")
    args = parser.parse_args()

    if not args.csv.exists():
        raise SystemExit(f"CSV 파일을 찾을 수 없습니다: {args.csv}\n--csv로 정확한 경로를 지정하세요.")

    rows = read_rows(args.csv)
    print(f"[import_hot_products_csv] {len(rows)}개 행을 읽었습니다: {args.csv}")

    if args.dry_run:
        for row in rows[:3]:
            print(row)
        print("... (--dry-run 이라 DB에는 쓰지 않았습니다)")
        return

    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")
    import psycopg2  # noqa: E402  (env 로드 이후, dry-run이 아닐 때만 필요)

    conn = psycopg2.connect(
        host=os.environ["POSTGRES_HOST"],
        port=os.environ["POSTGRES_PORT"],
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        sslmode=os.environ.get("POSTGRES_SSLMODE", "require"),
    )
    try:
        generated_at = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {TABLE} (
                    id SERIAL PRIMARY KEY,
                    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    rank INT NOT NULL,
                    product_name TEXT NOT NULL,
                    image_filename TEXT,
                    this_month_qty INT,
                    last_month_qty INT,
                    mom_growth_rate TEXT,
                    forecast_next_month_qty NUMERIC,
                    learned_growth_rate TEXT,
                    current_display_qty_per_vehicle INT,
                    recommended_additional_qty_raw INT,
                    recommended_additional_qty_learned INT,
                    notice TEXT
                )
                """
            )
            cur.execute(
                f"""
                CREATE INDEX IF NOT EXISTS idx_hot_product_recommendations_generated_at
                ON {TABLE} (generated_at)
                """
            )
            for row in rows:
                cur.execute(
                    f"""
                    INSERT INTO {TABLE} (
                        generated_at, rank, product_name, image_filename, this_month_qty, last_month_qty,
                        mom_growth_rate, forecast_next_month_qty, learned_growth_rate,
                        current_display_qty_per_vehicle, recommended_additional_qty_raw,
                        recommended_additional_qty_learned, notice
                    ) VALUES (
                        %(generated_at)s, %(rank)s, %(product_name)s, %(image_filename)s, %(this_month_qty)s, %(last_month_qty)s,
                        %(mom_growth_rate)s, %(forecast_next_month_qty)s, %(learned_growth_rate)s,
                        %(current_display_qty_per_vehicle)s, %(recommended_additional_qty_raw)s,
                        %(recommended_additional_qty_learned)s, %(notice)s
                    )
                    """,
                    {**row, "generated_at": generated_at},
                )
        conn.commit()
        print(f"[import_hot_products_csv] {len(rows)}개 행을 새 배치(generated_at={generated_at.isoformat()})로 적재했습니다.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
