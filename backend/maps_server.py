"""Run Maps and Google login without initializing Azure AI or PostgreSQL.

python -m uvicorn maps_server:app --app-dir backend --port 8000
"""
from fastapi import FastAPI

if __package__:
    from .naver_maps_api import router
    from .google_auth_api import router as auth_router
    from .survey_api import router as survey_router
else:
    from naver_maps_api import router
    from google_auth_api import router as auth_router
    from survey_api import router as survey_router

app = FastAPI(title='MOOV Maps and login')
app.include_router(router)
app.include_router(auth_router)
app.include_router(survey_router)
