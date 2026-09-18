# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config  # noqa: F401  # .env 로드 및 클라이언트 초기화를 가장 먼저 실행
from routers import chat, tts, stt

if __package__:
    from .outing_api import router as outing_router
else:
    from outing_api import router as outing_router

app = FastAPI()
app.include_router(outing_router)

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