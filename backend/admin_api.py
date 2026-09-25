"""Authenticated administrator APIs for the MOOV operations dashboard.

The dashboard keeps its existing UI, while this router provides the durable
server-side state that used to live only in browser localStorage.
"""
from __future__ import annotations

import ast
import json
import mimetypes
import os
import uuid
from datetime import datetime
from urllib.parse import quote
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

if __package__:
    from .db import get_conn, release_conn
    from .google_auth_api import require_auth_user
    from .hot_products_api import IMAGE_CONTAINER
else:
    from db import get_conn, release_conn
    from google_auth_api import require_auth_user
    from hot_products_api import IMAGE_CONTAINER

IMAGE_BASE_URL = os.getenv("IMAGE_BASE_URL", "").rstrip("/")


def to_image_url(filename: str | None) -> str | None:
    if not filename or not IMAGE_BASE_URL:
        return None
    return f"{IMAGE_BASE_URL}/{quote(filename)}"

router = APIRouter(prefix="/api/admin", tags=["admin"])
STATE_KEYS = {
    "products", "activities", "vehicle-themes", "selected-theme",
    "vehicles", "vehicle-audits", "config-ai", "config-themes",
}
CONFIG_KEYS = {"ai": "config-ai", "themes": "config-themes"}
MAX_STATE_BYTES = 2 * 1024 * 1024
MAX_IMPORT_ROWS = 5_000
MAX_ASSET_BYTES = 20 * 1024 * 1024
PRIVATE_HEADERS = {"Cache-Control": "no-store", "Pragma": "no-cache"}
_schema_ready = False


class StateBody(BaseModel):
    data: Any


def _csv_env(name: str) -> set[str]:
    return {value.strip().lower() for value in os.getenv(name, "").split(",") if value.strip()}


def require_admin_user(user: dict = Depends(require_auth_user)) -> dict:
    """Allow local demo administration or an explicitly allow-listed account."""
    if user.get("id") == "demo:moov":
        return user
    emails = _csv_env("MOOV_ADMIN_EMAILS")
    user_ids = _csv_env("MOOV_ADMIN_USER_IDS")
    if not emails and not user_ids:
        raise HTTPException(503, "관리자 허용 목록(MOOV_ADMIN_EMAILS)을 설정하세요.", headers=PRIVATE_HEADERS)
    if str(user.get("email") or "").lower() not in emails and str(user.get("id") or "").lower() not in user_ids:
        raise HTTPException(403, "관리자 권한이 없습니다.", headers=PRIVATE_HEADERS)
    return user


def ensure_admin_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS moov.admin_state (
                    state_key text PRIMARY KEY,
                    value_json jsonb NOT NULL,
                    version bigint NOT NULL DEFAULT 1,
                    updated_at timestamptz NOT NULL DEFAULT now(),
                    updated_by text NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS moov.admin_event_imports (
                    event_id text PRIMARY KEY,
                    payload_json jsonb NOT NULL,
                    occurred_at timestamptz NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    created_by text NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS moov.admin_payments (
                    transaction_id text PRIMARY KEY,
                    member_id text NOT NULL,
                    occurred_at timestamptz NOT NULL,
                    amount numeric(14,2) NOT NULL,
                    status text NOT NULL,
                    payload_json jsonb NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    created_by text NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS moov.admin_assets (
                    asset_id uuid PRIMARY KEY,
                    blob_name text NOT NULL UNIQUE,
                    content_type text NOT NULL,
                    size_bytes bigint NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    created_by text NOT NULL
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS admin_event_imports_occurred_idx ON moov.admin_event_imports (occurred_at DESC)")
            cur.execute("CREATE INDEX IF NOT EXISTS admin_payments_member_idx ON moov.admin_payments (member_id, occurred_at DESC)")
        conn.commit()
        _schema_ready = True
    except Exception:
        conn.rollback()
        raise
    finally:
        release_conn(conn)


def _json_value(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _validate_state(key: str, value: Any) -> None:
    if key not in STATE_KEYS:
        raise HTTPException(404, "지원하지 않는 관리자 상태입니다.")
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > MAX_STATE_BYTES:
        raise HTTPException(413, "관리자 설정은 2MB 이하여야 합니다.")


def _etag(key: str, version: int) -> str:
    return f'"admin-{key}-{version}"'


def _read_states(keys: set[str] | None = None) -> dict[str, dict[str, Any]]:
    ensure_admin_schema()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if keys:
                cur.execute("""
                    SELECT state_key, value_json, version, updated_at
                    FROM moov.admin_state WHERE state_key = ANY(%s)
                """, (list(keys),))
            else:
                cur.execute("SELECT state_key, value_json, version, updated_at FROM moov.admin_state")
            rows = cur.fetchall()
    finally:
        release_conn(conn)
    return {
        key: {"data": _json_value(value), "etag": _etag(key, int(version)), "updatedAt": updated.isoformat()}
        for key, value, version, updated in rows
    }


def _save_state(key: str, value: Any, user: dict, expected: str | None = None) -> dict[str, Any]:
    _validate_state(key, value)
    ensure_admin_schema()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT version FROM moov.admin_state WHERE state_key=%s FOR UPDATE", (key,))
            row = cur.fetchone()
            current = int(row[0]) if row else 0
            if expected and expected.startswith('"admin-') and expected != _etag(key, current):
                raise HTTPException(409, "다른 관리자가 먼저 저장했습니다. 새로고침 후 다시 시도하세요.")
            version = current + 1
            cur.execute("""
                INSERT INTO moov.admin_state (state_key, value_json, version, updated_at, updated_by)
                VALUES (%s, %s::jsonb, %s, now(), %s)
                ON CONFLICT (state_key) DO UPDATE SET
                    value_json=EXCLUDED.value_json, version=EXCLUDED.version,
                    updated_at=now(), updated_by=EXCLUDED.updated_by
                RETURNING updated_at
            """, (key, json.dumps(value, ensure_ascii=False), version, user["id"]))
            (saved_at,) = cur.fetchone()
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        release_conn(conn)
    return {"etag": _etag(key, version), "savedAt": saved_at.isoformat()}


def _member_rows() -> list[dict[str, Any]]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id, profile_json, created_at
                FROM moov.users
                WHERE COALESCE(is_synthetic, false) = false
                ORDER BY created_at DESC LIMIT 500
            """)
            rows = cur.fetchall()
    finally:
        release_conn(conn)
    members = []
    for user_id, raw_profile, created_at in rows:
        profile = _json_value(raw_profile)
        profile = profile if isinstance(profile, dict) else {}
        members.append({
            "id": str(user_id), "name": profile.get("name") or profile.get("email") or str(user_id),
            "email": profile.get("email") or "", "auth": "Google" if profile.get("provider") == "google" else "일반",
            "joined": created_at.astimezone().strftime("%Y.%m.%d") if created_at else "-",
            "purchases": 0, "purchaseAmount": 0, "taxiCount": 0, "taxiDuration": "-", "taxiFare": 0,
            "rentalCount": 0, "rentalDuration": "-", "rentalFare": 0, "total": 0, "status": "활성",
            "last": profile.get("last_login_at") or "-", "distance": "-", "theme": "기본",
            "consent": "정상", "security": "정상",
        })
    return members

def _product_image_map() -> dict[str, str]:
    """taxi_products.products의 SKU → 이미지 URL"""
    try:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT sku, image_filename FROM {PRODUCT_TABLE} WHERE image_filename IS NOT NULL")
                rows = cur.fetchall()
        finally:
            release_conn(conn)
    except Exception as exc:  # noqa: BLE001
        print(f"[admin] 상품 이미지 조회 실패: {exc}")
        return {}
    return {sku: url for sku, name in rows if (url := to_image_url(name))}


@router.get("/bootstrap")
def admin_bootstrap(user: dict = Depends(require_admin_user)):
    return JSONResponse({
        "authenticated": True,
        "user": user,
        "state": _read_states(),
        "members": _member_rows(),
        "productImages": _product_image_map(),
    }, headers=PRIVATE_HEADERS)


@router.get("/state/{key}")
def get_state(key: str, user: dict = Depends(require_admin_user)):
    del user
    state = _read_states({key}).get(key)
    if state is None:
        raise HTTPException(404, "저장된 관리자 상태가 없습니다.")
    return JSONResponse(state, headers={**PRIVATE_HEADERS, "ETag": state["etag"]})


@router.put("/state/{key}")
def put_state(key: str, payload: StateBody, request: Request, user: dict = Depends(require_admin_user)):
    return _save_state(key, payload.data, user, request.headers.get("if-match"))


@router.get("/config/{section}")
def get_config(section: str, user: dict = Depends(require_admin_user)):
    del user
    key = CONFIG_KEYS.get(section)
    if not key:
        raise HTTPException(404, "지원하지 않는 설정입니다.")
    state = _read_states({key}).get(key)
    if state is None:
        raise HTTPException(404, "저장된 설정이 없습니다.")
    return JSONResponse(state, headers={**PRIVATE_HEADERS, "ETag": state["etag"]})


@router.put("/config/{section}")
async def put_config(section: str, request: Request, user: dict = Depends(require_admin_user)):
    key = CONFIG_KEYS.get(section)
    if not key:
        raise HTTPException(404, "지원하지 않는 설정입니다.")
    try:
        value = await request.json()
    except Exception:
        raise HTTPException(400, "JSON 설정을 확인하세요.") from None
    return _save_state(key, value, user, request.headers.get("if-match"))


def _validate_import_rows(value: Any, kind: str) -> list[dict[str, Any]]:
    rows = value if isinstance(value, list) else [value]
    if not rows or len(rows) > MAX_IMPORT_ROWS or any(not isinstance(row, dict) for row in rows):
        raise HTTPException(400, f"{kind} 데이터는 1~{MAX_IMPORT_ROWS}개의 JSON 객체여야 합니다.")
    return rows


@router.get("/events")
def get_events(user: dict = Depends(require_admin_user)):
    del user
    ensure_admin_schema()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT payload_json FROM moov.admin_event_imports ORDER BY occurred_at DESC LIMIT 10000")
            rows = [_json_value(row[0]) for row in cur.fetchall()]
    finally:
        release_conn(conn)
    return {"rows": rows}


@router.post("/events")
async def post_events(request: Request, user: dict = Depends(require_admin_user)):
    try:
        rows = _validate_import_rows(await request.json(), "운영 이벤트")
    except json.JSONDecodeError:
        raise HTTPException(400, "이벤트 JSON을 확인하세요.") from None
    ensure_admin_schema()
    inserted = duplicates = 0
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            for row in rows:
                event_id, event_type = str(row.get("id") or "")[:200], str(row.get("type") or "")
                if not event_id or event_type not in {"usage", "health"}:
                    raise HTTPException(400, "각 이벤트에는 고유 id와 usage 또는 health type이 필요합니다.")
                try:
                    occurred = datetime.fromisoformat(str(row.get("at") or "").replace("Z", "+00:00"))
                except ValueError:
                    raise HTTPException(400, f"이벤트 {event_id}의 at 시간이 올바르지 않습니다.") from None
                cur.execute("""
                    INSERT INTO moov.admin_event_imports (event_id, payload_json, occurred_at, created_by)
                    VALUES (%s, %s::jsonb, %s, %s) ON CONFLICT (event_id) DO NOTHING
                """, (event_id, json.dumps(row, ensure_ascii=False), occurred, user["id"]))
                inserted += int(bool(cur.rowcount)); duplicates += int(not cur.rowcount)
        conn.commit()
    except HTTPException:
        conn.rollback(); raise
    except Exception:
        conn.rollback(); raise
    finally:
        release_conn(conn)
    return {"inserted": inserted, "duplicates": duplicates}


@router.get("/payments")
def get_payments(user: dict = Depends(require_admin_user)):
    del user
    ensure_admin_schema()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT payload_json FROM moov.admin_payments ORDER BY occurred_at DESC LIMIT 10000")
            rows = [_json_value(row[0]) for row in cur.fetchall()]
    finally:
        release_conn(conn)
    return {"rows": rows}


@router.post("/payments")
async def post_payments(request: Request, user: dict = Depends(require_admin_user)):
    try:
        rows = _validate_import_rows(await request.json(), "결제")
    except json.JSONDecodeError:
        raise HTTPException(400, "결제 JSON을 확인하세요.") from None
    ensure_admin_schema()
    inserted = duplicates = 0
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            for row in rows:
                transaction_id, member_id = str(row.get("id") or "")[:200], str(row.get("memberId") or "")[:200]
                status = str(row.get("status") or "")
                if not transaction_id or not member_id or status not in {"paid", "refunded", "cancelled"}:
                    raise HTTPException(400, "결제 id, memberId, status를 확인하세요.")
                try:
                    occurred = datetime.fromisoformat(str(row.get("at") or "").replace("Z", "+00:00")); amount = float(row.get("amount") or 0)
                except (TypeError, ValueError):
                    raise HTTPException(400, f"결제 {transaction_id}의 시간 또는 금액이 올바르지 않습니다.") from None
                cur.execute("""
                    INSERT INTO moov.admin_payments
                        (transaction_id, member_id, occurred_at, amount, status, payload_json, created_by)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s) ON CONFLICT (transaction_id) DO NOTHING
                """, (transaction_id, member_id, occurred, amount, status, json.dumps(row, ensure_ascii=False), user["id"]))
                inserted += int(bool(cur.rowcount)); duplicates += int(not cur.rowcount)
        conn.commit()
    except HTTPException:
        conn.rollback(); raise
    except Exception:
        conn.rollback(); raise
    finally:
        release_conn(conn)
    return {"inserted": inserted, "duplicates": duplicates}


def _parse_python_prompts(source: str) -> dict[str, str]:
    if len(source.encode("utf-8")) > 500_000:
        raise HTTPException(413, "Python 파일은 500KB 이하여야 합니다.")
    try:
        tree = ast.parse(source, mode="exec")
    except SyntaxError:
        raise HTTPException(400, "Python 문법을 확인하세요.") from None
    values: dict[str, Any] = {}
    for node in tree.body:
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        for target in targets:
            if isinstance(target, ast.Name) and target.id in {"COMMON_SYSTEM_PROMPT", "PERSONA_PROMPTS"}:
                try:
                    values[target.id] = ast.literal_eval(node.value)
                except (ValueError, TypeError, SyntaxError):
                    raise HTTPException(400, f"{target.id}는 문자열 리터럴이어야 합니다.") from None
    common, personas = values.get("COMMON_SYSTEM_PROMPT"), values.get("PERSONA_PROMPTS")
    required = ("moove", "todaki", "expert", "lingo")
    if not isinstance(common, str) or not isinstance(personas, dict) or any(not isinstance(personas.get(key), str) for key in required):
        raise HTTPException(400, "COMMON_SYSTEM_PROMPT와 네 페르소나 프롬프트가 필요합니다.")
    return {"common": common, **{key: personas[key] for key in required}}


@router.post("/python")
async def parse_python(request: Request, user: dict = Depends(require_admin_user)):
    del user
    try:
        source = (await request.body()).decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        raise HTTPException(400, "UTF-8 Python 파일만 지원합니다.") from None
    return {"prompts": _parse_python_prompts(source)}


def _asset_container():
    from azure.storage.blob import BlobServiceClient
    from azure.core.exceptions import ResourceExistsError
    connection = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
    if not connection:
        raise HTTPException(503, "Azure Storage 연결 설정이 필요합니다.")
    container = BlobServiceClient.from_connection_string(connection).get_container_client(os.getenv("AZURE_STORAGE_ADMIN_CONTAINER", "admin-assets"))
    try:
        container.create_container()
    except ResourceExistsError:
        pass
    return container


@router.post("/assets")
async def upload_asset(request: Request, user: dict = Depends(require_admin_user)):
    body = await request.body()
    content_type = request.headers.get("content-type", "application/octet-stream").split(";", 1)[0].lower()
    if not body or len(body) > MAX_ASSET_BYTES:
        raise HTTPException(413, "파일은 1바이트 이상 20MB 이하여야 합니다.")
    if not (content_type.startswith("image/") or content_type.startswith("audio/")):
        raise HTTPException(415, "이미지 또는 오디오 파일만 업로드할 수 있습니다.")
    extension = mimetypes.guess_extension(content_type) or ""
    asset_id = uuid.uuid4(); blob_name = f"{asset_id.hex}{extension}"
    try:
        from azure.storage.blob import ContentSettings
        _asset_container().upload_blob(blob_name, body, overwrite=False, content_settings=ContentSettings(content_type=content_type))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "관리자 파일 저장소에 업로드하지 못했습니다.") from None
    ensure_admin_schema()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO moov.admin_assets (asset_id, blob_name, content_type, size_bytes, created_by)
                VALUES (%s, %s, %s, %s, %s)
            """, (str(asset_id), blob_name, content_type, len(body), user["id"]))
        conn.commit()
    except Exception:
        conn.rollback()
        try: _asset_container().delete_blob(blob_name)
        except Exception: pass
        raise
    finally:
        release_conn(conn)
    return {"url": f"/api/admin/assets/{asset_id}"}


@router.get("/assets/{asset_id}")
def get_asset(asset_id: uuid.UUID, user: dict = Depends(require_auth_user)):
    del user
    ensure_admin_schema()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT blob_name, content_type FROM moov.admin_assets WHERE asset_id=%s", (str(asset_id),)); row = cur.fetchone()
    finally:
        release_conn(conn)
    if not row:
        raise HTTPException(404, "파일을 찾을 수 없습니다.")
    try:
        data = _asset_container().download_blob(row[0]).readall()
    except Exception:
        raise HTTPException(503, "관리자 파일을 불러오지 못했습니다.") from None
    return Response(data, media_type=row[1], headers={"Cache-Control": "private, max-age=3600"})

PRODUCT_TABLE = "taxi_products.products"


def _product_image_container():
    from azure.storage.blob import BlobServiceClient
    client = BlobServiceClient.from_connection_string(os.environ["AZURE_STORAGE_CONNECTION_STRING"])
    return client.get_container_client(IMAGE_CONTAINER)


@router.post("/product-images")
async def upload_product_image(request: Request, user: dict = Depends(require_admin_user)):
    del user
    body = await request.body()
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if not body or len(body) > MAX_ASSET_BYTES:
        raise HTTPException(413, "이미지는 1바이트 이상 20MB 이하여야 합니다.")
    if not content_type.startswith("image/"):
        raise HTTPException(415, "이미지 파일만 업로드할 수 있습니다.")

    extension = mimetypes.guess_extension(content_type) or ".jpg"
    filename = f"product-{uuid.uuid4().hex}{extension}"
    try:
        from azure.storage.blob import ContentSettings
        _product_image_container().upload_blob(filename, body, overwrite=False, content_settings=ContentSettings(content_type=content_type))
    except Exception:
        raise HTTPException(503, "상품 이미지를 저장하지 못했습니다.") from None
    return {"image_filename": filename, "url": f"/api/hot-products/images/{filename}"}


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=50)
    price: int = Field(ge=0)
    description: str = Field(default="", max_length=200)
    image_filename: str | None = None


@router.post("/products")
def create_product(product: ProductCreate, user: dict = Depends(require_admin_user)):
    del user
    sku = product.sku.strip().upper()
    app_product_id = sku.lower()
    if product.image_filename and ("/" in product.image_filename or ".." in product.image_filename):
        raise HTTPException(400, "잘못된 이미지 파일명입니다.")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT 1 FROM {PRODUCT_TABLE} WHERE sku=%s OR app_product_id=%s", (sku, app_product_id))
            if cur.fetchone():
                raise HTTPException(409, "이미 등록된 SKU입니다.")
            cur.execute(
                f"""
                INSERT INTO {PRODUCT_TABLE} (sku, app_product_id, name, description, category, price, image_filename)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (sku, app_product_id, product.name.strip(), product.description.strip(), product.category, product.price, product.image_filename),
            )
            (product_id,) = cur.fetchone()
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(500, "상품을 저장하지 못했습니다.") from None
    finally:
        release_conn(conn)
    return {"id": product_id, "sku": sku, "app_product_id": app_product_id}