# server/routes/keys.py
# API Key 管理 REST 端点 —— /api/providers 和 /api/keys/*
from __future__ import annotations  # Python 3.9 兼容 str | None 语法
import json
import uuid
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import require_auth
from services.crypto_service import encrypt, decrypt
from models import KeyCreate
import httpx

router = APIRouter()


# ── 厂商列表 ──

@router.get("/api/providers")
def list_providers(_token: str = Depends(require_auth)):
    """返回所有活跃的 AI 厂商"""
    db = get_db()
    rows = db.execute(
        "SELECT id, name, slug, base_url, logo_url FROM provider WHERE is_active = 1 ORDER BY name"
    ).fetchall()
    db.close()
    return [dict(row) for row in rows]


# ── Key 列表 ──

@router.get("/api/keys")
def list_keys(_token: str = Depends(require_auth)):
    """返回所有非删除状态的 Key，联表带出 provider name"""
    db = get_db()
    rows = db.execute("""
        SELECT ak.id, p.name AS provider_name, ak.alias, ak.key_suffix,
               ak.status, ak.tags, ak.usage, ak.test_result,
               ak.created_at, ak.updated_at
        FROM api_key ak
        INNER JOIN provider p ON p.id = ak.provider_id
        WHERE ak.status != 'deleted'
        ORDER BY ak.created_at DESC
    """).fetchall()
    db.close()
    return [dict(row) for row in rows]


# ── 创建 Key ──

@router.post("/api/keys", status_code=201)
def create_key(body: KeyCreate, _token: str = Depends(require_auth)):
    """加密存储新 Key，返回创建后的 Key 对象"""
    db = get_db()

    # 校验厂商是否存在
    provider = db.execute(
        "SELECT id, name FROM provider WHERE id = ?", (body.provider_id,)
    ).fetchone()
    if not provider:
        db.close()
        raise HTTPException(400, "厂商不存在")

    # AES-256-GCM 加密
    encrypted = encrypt(body.key_value)
    key_suffix = body.key_value[-6:]  # 取明文后 6 位
    key_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    db.execute("""
        INSERT INTO api_key (id, provider_id, alias, encrypted_key, key_suffix, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    """, (key_id, body.provider_id, body.alias, encrypted, key_suffix, now, now))
    db.commit()

    # 返回新建的 Key
    row = db.execute("""
        SELECT ak.id, p.name AS provider_name, ak.alias, ak.key_suffix,
               ak.status, ak.tags, ak.usage, ak.test_result,
               ak.created_at, ak.updated_at
        FROM api_key ak
        INNER JOIN provider p ON p.id = ak.provider_id
        WHERE ak.id = ?
    """, (key_id,)).fetchone()
    db.close()
    return dict(row)


# ── 删除 Key（软删除） ──

@router.delete("/api/keys/{key_id}")
def delete_key(key_id: str, _token: str = Depends(require_auth)):
    """软删除：将 status 设为 'deleted'"""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    cur = db.execute(
        "UPDATE api_key SET status = 'deleted', updated_at = ? WHERE id = ? AND status != 'deleted'",
        (now, key_id)
    )
    db.commit()
    if cur.rowcount == 0:
        db.close()
        raise HTTPException(404, "Key 不存在或已删除")
    db.close()
    return {"ok": True}


# ── 启用/禁用切换 ──

@router.put("/api/keys/{key_id}/toggle")
def toggle_key(key_id: str, _token: str = Depends(require_auth)):
    """在 active 和 disabled 之间切换"""
    db = get_db()

    row = db.execute(
        "SELECT status FROM api_key WHERE id = ? AND status != 'deleted'",
        (key_id,)
    ).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Key 不存在或已删除")

    new_status = "disabled" if row["status"] == "active" else "active"
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE api_key SET status = ?, updated_at = ? WHERE id = ?",
        (new_status, now, key_id)
    )
    db.commit()
    db.close()
    return {"ok": True, "status": new_status}


# ── 连通性测试 ──

@router.post("/api/keys/{key_id}/test")
def test_key(key_id: str, _token: str = Depends(require_auth)):
    """解密 Key，调厂商 /models 接口验证连通性，记录测试结果"""
    db = get_db()

    row = db.execute("""
        SELECT ak.id, ak.encrypted_key, p.base_url
        FROM api_key ak
        INNER JOIN provider p ON p.id = ak.provider_id
        WHERE ak.id = ? AND ak.status != 'deleted'
    """, (key_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Key 不存在或已删除")

    # 解密 Key
    try:
        plain_key = decrypt(row["encrypted_key"])
    except Exception:
        record_test(db, key_id, False, 0, "解密失败")
        db.close()
        return {"ok": False, "latency_ms": 0, "error": "解密失败", "models": []}

    # 调厂商 /models 接口
    base_url = row["base_url"].rstrip("/")
    test_url = f"{base_url}/models"
    models = []

    try:
        start = time.time()
        resp = httpx.get(
            test_url,
            headers={"Authorization": f"Bearer {plain_key}"},
            timeout=15.0
        )
        latency_ms = int((time.time() - start) * 1000)

        if resp.status_code == 401 or resp.status_code == 403:
            record_test(db, key_id, False, latency_ms, "认证失败，请检查 Key 是否正确")
            db.close()
            return {"ok": False, "latency_ms": latency_ms, "error": "认证失败", "models": []}

        if resp.status_code != 200:
            record_test(db, key_id, False, latency_ms, f"HTTP {resp.status_code}")
            db.close()
            return {"ok": False, "latency_ms": latency_ms, "error": f"HTTP {resp.status_code}", "models": []}

        data = resp.json()
        # 尝试从返回中提取模型 ID 列表
        model_list = data.get("data", data.get("models", []))
        if isinstance(model_list, list):
            models = [m.get("id", str(m)) if isinstance(m, dict) else str(m) for m in model_list[:50]]

        record_test(db, key_id, True, latency_ms, None)
        db.close()
        return {"ok": True, "latency_ms": latency_ms, "error": None, "models": models}

    except httpx.TimeoutException:
        record_test(db, key_id, False, 0, "请求超时（15s）")
        db.close()
        return {"ok": False, "latency_ms": 0, "error": "请求超时", "models": []}
    except Exception as e:
        record_test(db, key_id, False, 0, str(e))
        db.close()
        return {"ok": False, "latency_ms": 0, "error": str(e), "models": []}


def record_test(db, key_id: str, ok: bool, latency_ms: int, error: str | None):
    """将测试结果记录到 api_key.test_result JSON 字段，保留最近 7 次"""
    row = db.execute("SELECT test_result FROM api_key WHERE id = ?", (key_id,)).fetchone()
    records = json.loads(row["test_result"]) if row else []
    records.append({
        "time": datetime.now(timezone.utc).isoformat(),
        "success": ok,
        "latency_ms": latency_ms,
        "error": error,
    })
    # 只保留最近 7 次
    records = records[-7:]
    db.execute(
        "UPDATE api_key SET test_result = ?, updated_at = ? WHERE id = ?",
        (json.dumps(records, ensure_ascii=False), datetime.now(timezone.utc).isoformat(), key_id)
    )
    db.commit()
