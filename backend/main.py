# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config  # noqa: F401  # .env 로드 및 클라이언트 초기화를 가장 먼저 실행
from routers import chat, tts, stt

if __package__:
    from .outing_api import router as outing_router
    from .naver_maps_api import router as maps_router
    from .google_auth_api import router as auth_router
    from .survey_api import router as survey_router
    from .hot_products_api import router as hot_products_router, ensure_table as ensure_hot_products_table
    from .admin_api import router as admin_router, ensure_admin_schema
else:
    from outing_api import router as outing_router
    from naver_maps_api import router as maps_router
    from google_auth_api import router as auth_router
    from survey_api import router as survey_router
    from hot_products_api import router as hot_products_router, ensure_table as ensure_hot_products_table
    from admin_api import router as admin_router, ensure_admin_schema

app = FastAPI()
app.include_router(outing_router)
app.include_router(maps_router)
app.include_router(auth_router)
app.include_router(survey_router)
app.include_router(hot_products_router)
app.include_router(admin_router)


@app.on_event("startup")
def _ensure_hot_products_table():
    # 앱이 뜰 때 taxi_products.hot_product_recommendations 테이블이 없으면 만들어둔다.
    # (실제 데이터 적재는 scripts/import_hot_products_csv.py로 별도 실행)
    try:
        ensure_hot_products_table()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] hot_product_recommendations 테이블 준비 실패(연결 문제일 수 있음): {exc}")
    try:
        ensure_admin_schema()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] admin schema preparation failed (database may be offline): {exc}")

# 로컬 프론트 개발 서버 주소로 제한 (배포 시 실제 도메인으로 교체)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(tts.router)
app.include_router(stt.router)
