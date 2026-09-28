# Azure App Service 진입점: FastAPI(백엔드) + front/public(화면)을 한 주소에서 제공
import sys
from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "front" / "public"
sys.path.insert(0, str(ROOT / "backend"))

from main import app  # noqa: E402


@app.get("/", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
def index():
    return FileResponse(PUBLIC / "moov.html")


@app.get("/dashboard", include_in_schema=False)
@app.get("/dashboard/", include_in_schema=False)
def dashboard():
    return FileResponse(PUBLIC / "dashboard" / "index.html")


app.mount("/", StaticFiles(directory=PUBLIC), name="public")
