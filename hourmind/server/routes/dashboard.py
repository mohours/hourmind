# server/routes/dashboard.py
# 仪表盘路由 —— 返回聚合统计数据：今日 Token、活跃 Key 数、会话数、最近会话
import json  # JSON 解析
from fastapi import APIRouter, Depends  # FastAPI 路由与依赖注入
from database import get_db  # 数据库连接
from auth import require_auth  # JWT 认证依赖

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(_token: str = Depends(require_auth)):
    """仪表盘聚合数据 —— 返回 token 用量、活跃 key、会话统计"""
    db = get_db()  # 获取数据库连接
    try:
        # ── 统计活跃 Key 数量 ──
        active_key_count = db.execute(
            "SELECT COUNT(*) AS count FROM api_key WHERE status = 'active'"
        ).fetchone()["count"]

        # ── 统计今日 Token 用量（从对话表汇总今天更新的对话）──
        today_row = db.execute("""
            SELECT COALESCE(SUM(total_tokens), 0) AS total
            FROM conversation
            WHERE date(updated_at) = date('now')
            AND status = 'active'
        """).fetchone()
        today_tokens = today_row["total"] if today_row else 0  # 今日 Token 总数

        # ── 统计会话总数 ──
        conversation_count = db.execute(
            "SELECT COUNT(*) AS count FROM conversation WHERE status = 'active'"
        ).fetchone()["count"]

        # ── 最近 5 条活跃会话（联表 api_key 获取密钥别名，联表 provider 获取厂商名）──
        recent_rows = db.execute("""
            SELECT c.id, c.title, c.model, c.message_count, c.total_tokens,
                   c.created_at, c.updated_at, c.is_pinned, c.is_starred,
                   ak.alias AS key_alias, p.name AS provider_name
            FROM conversation c
            INNER JOIN api_key ak ON ak.status != 'deleted'
            INNER JOIN provider p ON p.id = ak.provider_id
            WHERE c.status = 'active'
            ORDER BY c.updated_at DESC
            LIMIT 5
        """).fetchall()

        recent_conversations = [dict(row) for row in recent_rows]  # 转换为字典列表

        # ── 组装返回体 ──
        return {
            "today_tokens": today_tokens,
            "active_key_count": active_key_count,
            "conversation_count": conversation_count,
            "recent_conversations": recent_conversations,
        }
    finally:
        db.close()  # 确保关闭数据库连接
