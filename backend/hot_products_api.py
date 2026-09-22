"""핫 아이템(인기 급상승 30개 품목) 재고/추가배치 권고 API.

demand_report_v2.11 알고리즘이 만드는
`output/10_hot_products_learned_recommendation.csv`를
scripts/import_hot_products_csv.py로 Postgres(taxi_products 스키마)에
적재해두면, 이 라우터가 그 최신 배치를 읽어서 그대로 내려준다.

프론트(ms_p2_777/front/public/moov.html)의 "차량 재고 새로고침" 버튼이
이 엔드포인트를 호출해서 현재 진열수량 -> (현재 + 학습 기반 추가배치
권고수량)으로 화면 숫자를 갱신하는 데 쓴다. 이 라우터는 조회 전용이며,
재고를 실제로 쓰거나 바꾸지 않는다(현재 요구사항: "화면 표시만 갱신").
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from db import get_conn, release_conn

router = APIRouter(prefix="/api/hot-products", tags=["hot-products"])

SCHEMA = "taxi_products"
TABLE = f"{SCHEMA}.hot_product_recommendations"


def ensure_table():
    """스키마/테이블이 없으면 만든다. 앱 시작 시 한 번, import 스크립트 실행 시에도 호출된다."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {TABLE} (
                    id SERIAL PRIMARY KEY,
                    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    rank INT NOT NULL,
                    product_name TEXT NOT NULL,
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
        conn.commit()
    finally:
        release_conn(conn)


@router.get("")
def get_latest_hot_products():
    """가장 최근에 import된 배치(30개 행)를 rank 순으로 반환한다.

    각 행: rank, product_name, this_month_qty, last_month_qty,
    mom_growth_rate, forecast_next_month_qty, learned_growth_rate,
    current_display_qty_per_vehicle, recommended_additional_qty_raw,
    recommended_additional_qty_learned, notice
    프론트 "상품" 페이지는 current_display_qty_per_vehicle +
    recommended_additional_qty_learned만 쓰고, 관리자 페이지는 전체를 쓴다.
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT rank, product_name, this_month_qty, last_month_qty,
                       mom_growth_rate, forecast_next_month_qty, learned_growth_rate,
                       current_display_qty_per_vehicle, recommended_additional_qty_raw,
                       recommended_additional_qty_learned, notice
                FROM {TABLE}
                WHERE generated_at = (SELECT MAX(generated_at) FROM {TABLE})
                ORDER BY rank
                """
            )
            rows = cur.fetchall()
            cur.execute(f"SELECT MAX(generated_at) FROM {TABLE}")
            (generated_at,) = cur.fetchone()
        if not rows:
            raise HTTPException(status_code=404, detail="아직 import된 hot products 데이터가 없습니다")
        columns = [
            "rank", "product_name", "this_month_qty", "last_month_qty",
            "mom_growth_rate", "forecast_next_month_qty", "learned_growth_rate",
            "current_display_qty_per_vehicle", "recommended_additional_qty_raw",
            "recommended_additional_qty_learned", "notice",
        ]
        return {
            "generated_at": generated_at.isoformat() if generated_at else None,
            "items": [dict(zip(columns, row)) for row in rows],
        }
    finally:
        release_conn(conn)
