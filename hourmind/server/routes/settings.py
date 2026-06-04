# server/routes/settings.py
# 系统设置 REST 端点 —— 读取和更新应用配置
from fastapi import APIRouter, Depends
from database import get_db
from auth import require_auth

router = APIRouter(prefix="/api/settings", tags=["settings"])

# 默认配置值
DEFAULTS = {
    "ai_default_model": "gpt-4o",
    "ai_temperature": "0.7",
    "ai_max_tokens": "4096",
    "app_theme": "dark",
    "app_language": "zh-CN",
}


@router.get("")
def get_settings(_token: str = Depends(require_auth)):
    """读取所有设置 —— 从 config 表取，缺失字段用默认值"""
    db = get_db()
    try:
        rows = db.execute("SELECT key, value FROM config WHERE key LIKE 'ai_%' OR key LIKE 'app_%'").fetchall()
        # 以数据库值为准，补齐默认值
        settings = dict(DEFAULTS)  # 复制默认值
        for row in rows:
            settings[row["key"]] = row["value"]  # 覆盖
        return settings
    finally:
        db.close()


@router.put("")
def update_settings(body: dict, _token: str = Depends(require_auth)):
    """批量更新设置 —— { key: value, ... }，只更新传入的字段"""
    db = get_db()
    try:
        for key, value in body.items():
            # 只允许白名单字段
            if key in DEFAULTS:
                db.execute(
                    "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
                    (key, str(value), str(value)),
                )
        db.commit()
        # 返回更新后的全部设置
        rows = db.execute("SELECT key, value FROM config WHERE key LIKE 'ai_%' OR key LIKE 'app_%'").fetchall()
        settings = dict(DEFAULTS)
        for row in rows:
            settings[row["key"]] = row["value"]
        return settings
    finally:
        db.close()
