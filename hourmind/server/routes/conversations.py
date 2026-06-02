# server/routes/conversations.py
# 对话会话 REST API —— 列表/创建/详情/更新/软删除/批量删除
import json  # JSON 序列化/反序列化
import uuid  # UUID 生成器
from datetime import datetime, timezone  # 时间处理

from fastapi import APIRouter, Depends, HTTPException, Query  # FastAPI 组件
from database import get_db  # 数据库连接
from auth import require_auth  # JWT 认证依赖注入
from models import ConversationCreate, ConversationUpdate  # Pydantic 模型

router = APIRouter(prefix="/api/conversations", tags=["conversations"])  # 路由前缀和标签


# ── GET /api/conversations —— 分页列表 ──

@router.get("")
def list_conversations(
    status: str = Query("active", description="状态过滤: active / archived / deleted"),
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    _token: str = Depends(require_auth),
):
    """
    获取对话列表 —— 支持状态过滤和分页
    按 is_pinned DESC, updated_at DESC 排序
    """
    db = get_db()  # 获取数据库连接
    try:
        offset = (page - 1) * page_size  # 计算偏移量

        # 查询满足条件的会话总数
        total_row = db.execute(
            "SELECT COUNT(*) as cnt FROM conversation WHERE status = ?",
            (status,)
        ).fetchone()  # 计数查询
        total = total_row["cnt"]  # 总记录数

        # 查询当前页数据
        rows = db.execute("""
            SELECT id, title, model, is_pinned, is_starred, status,
                   summary, total_tokens, message_count, created_at, updated_at
            FROM conversation
            WHERE status = ?
            ORDER BY is_pinned DESC, updated_at DESC
            LIMIT ? OFFSET ?
        """, (status, page_size, offset)).fetchall()  # 分页数据

        items = []  # 构建响应列表
        for row in rows:
            items.append({
                "id": row["id"],  # 会话 ID
                "title": row["title"],  # 标题
                "model": row["model"],  # 模型标识
                "is_pinned": bool(row["is_pinned"]),  # 是否置顶
                "is_starred": bool(row["is_starred"]),  # 是否收藏
                "status": row["status"],  # 状态
                "summary": row["summary"],  # 摘要
                "total_tokens": row["total_tokens"],  # 总 Token 消耗
                "message_count": row["message_count"],  # 消息条数
                "created_at": row["created_at"],  # 创建时间
                "updated_at": row["updated_at"],  # 更新时间
            })

        return {
            "items": items,  # 当前页数据
            "total": total,  # 总数
            "page": page,  # 当前页码
            "page_size": page_size,  # 每页条数
            "total_pages": (total + page_size - 1) // page_size,  # 总页数（向上取整）
        }
    finally:
        db.close()  # 关闭数据库连接


# ── POST /api/conversations —— 创建新会话 ──

@router.post("", status_code=201)
def create_conversation(body: ConversationCreate, _token: str = Depends(require_auth)):
    """创建新对话会话 —— 返回新创建的会话对象"""
    db = get_db()  # 获取数据库连接
    try:
        conv_id = str(uuid.uuid4())  # 生成唯一 ID
        now = datetime.now(timezone.utc).isoformat()  # 当前 UTC 时间

        db.execute("""
            INSERT INTO conversation (id, title, model, messages_json, created_at, updated_at)
            VALUES (?, ?, ?, '[]', ?, ?)
        """, (
            conv_id,  # 主键 ID
            body.title,  # 会话标题
            body.model,  # 模型标识
            now,  # 创建时间
            now,  # 更新时间
        ))
        db.commit()  # 提交事务

        # 查询刚创建的会话返回给前端
        row = db.execute("""
            SELECT id, title, model, is_pinned, is_starred, status,
                   summary, total_tokens, message_count, created_at, updated_at
            FROM conversation
            WHERE id = ?
        """, (conv_id,)).fetchone()  # 取回新建记录

        return {
            "id": row["id"],  # 会话 ID
            "title": row["title"],  # 标题
            "model": row["model"],  # 模型
            "is_pinned": bool(row["is_pinned"]),  # 是否置顶
            "is_starred": bool(row["is_starred"]),  # 是否收藏
            "status": row["status"],  # 状态
            "summary": row["summary"],  # 摘要
            "total_tokens": row["total_tokens"],  # Token 用量
            "message_count": row["message_count"],  # 消息条数
            "created_at": row["created_at"],  # 创建时间
            "updated_at": row["updated_at"],  # 更新时间
        }
    finally:
        db.close()  # 关闭数据库连接


# ── GET /api/conversations/{id} —— 获取单个会话详情 ──

@router.get("/{conv_id}")
def get_conversation(conv_id: str, _token: str = Depends(require_auth)):
    """获取单个对话会话 —— 含完整 messages_json"""
    db = get_db()  # 获取数据库连接
    try:
        row = db.execute(
            "SELECT * FROM conversation WHERE id = ?", (conv_id,)
        ).fetchone()  # 按主键查询

        if not row:  # 会话不存在
            raise HTTPException(status_code=404, detail="会话不存在")

        return {
            "id": row["id"],  # 会话 ID
            "title": row["title"],  # 标题
            "model": row["model"],  # 模型
            "messages_json": row["messages_json"],  # 完整消息 JSON 字符串
            "is_pinned": bool(row["is_pinned"]),  # 是否置顶
            "is_starred": bool(row["is_starred"]),  # 是否收藏
            "status": row["status"],  # 状态
            "summary": row["summary"],  # 摘要
            "total_tokens": row["total_tokens"],  # Token 用量
            "message_count": row["message_count"],  # 消息条数
            "created_at": row["created_at"],  # 创建时间
            "updated_at": row["updated_at"],  # 更新时间
        }
    finally:
        db.close()  # 关闭数据库连接


# ── PATCH /api/conversations/{id} —— 更新会话 ──

@router.patch("/{conv_id}")
def update_conversation(conv_id: str, body: ConversationUpdate, _token: str = Depends(require_auth)):
    """部分更新会话 —— title / is_pinned / is_starred"""
    db = get_db()  # 获取数据库连接
    try:
        # 先确认会话存在
        existing = db.execute(
            "SELECT id FROM conversation WHERE id = ?", (conv_id,)
        ).fetchone()  # 存在性检查

        if not existing:  # 会话不存在
            raise HTTPException(status_code=404, detail="会话不存在")

        now = datetime.now(timezone.utc).isoformat()  # 当前时间

        # 逐字段动态更新（仅更新传了值的字段）
        if body.title is not None:  # 更新标题
            db.execute(
                "UPDATE conversation SET title = ?, updated_at = ? WHERE id = ?",
                (body.title, now, conv_id),
            )
        if body.is_pinned is not None:  # 更新置顶状态（bool -> int）
            db.execute(
                "UPDATE conversation SET is_pinned = ?, updated_at = ? WHERE id = ?",
                (int(body.is_pinned), now, conv_id),
            )
        if body.is_starred is not None:  # 更新收藏状态（bool -> int）
            db.execute(
                "UPDATE conversation SET is_starred = ?, updated_at = ? WHERE id = ?",
                (int(body.is_starred), now, conv_id),
            )

        db.commit()  # 提交事务

        # 返回更新后的会话
        row = db.execute("SELECT * FROM conversation WHERE id = ?", (conv_id,)).fetchone()  # 取回最新数据
        return {
            "id": row["id"],  # 会话 ID
            "title": row["title"],  # 标题
            "model": row["model"],  # 模型
            "is_pinned": bool(row["is_pinned"]),  # 是否置顶
            "is_starred": bool(row["is_starred"]),  # 是否收藏
            "status": row["status"],  # 状态
            "summary": row["summary"],  # 摘要
            "total_tokens": row["total_tokens"],  # Token 用量
            "message_count": row["message_count"],  # 消息条数
            "created_at": row["created_at"],  # 创建时间
            "updated_at": row["updated_at"],  # 更新时间
        }
    finally:
        db.close()  # 关闭数据库连接


# ── DELETE /api/conversations/{id} —— 软删除 ──

@router.delete("/{conv_id}")
def delete_conversation(conv_id: str, _token: str = Depends(require_auth)):
    """软删除会话 —— 将 status 设为 'deleted'"""
    db = get_db()  # 获取数据库连接
    try:
        now = datetime.now(timezone.utc).isoformat()  # 当前时间
        cur = db.execute(
            "UPDATE conversation SET status = 'deleted', updated_at = ? WHERE id = ? AND status != 'deleted'",
            (now, conv_id),
        )  # 仅更新非已删除状态的记录
        db.commit()  # 提交事务

        if cur.rowcount == 0:  # 没有命中任何行
            raise HTTPException(status_code=404, detail="会话不存在或已删除")

        return {"ok": True}  # 删除成功
    finally:
        db.close()  # 关闭数据库连接


# ── POST /api/conversations/batch-delete —— 批量软删除 ──

@router.post("/batch-delete")
def batch_delete_conversations(body: dict, _token: str = Depends(require_auth)):
    """批量软删除 —— 通过 ids 列表批量标记为 deleted"""
    ids = body.get("ids", [])  # 从请求体提取 ID 列表
    if not ids or not isinstance(ids, list):  # 参数校验
        raise HTTPException(status_code=400, detail="请提供 ids 数组")

    db = get_db()  # 获取数据库连接
    try:
        now = datetime.now(timezone.utc).isoformat()  # 当前时间
        placeholders = ",".join(["?"] * len(ids))  # 生成占位符 "?,?,?,..."

        cur = db.execute(
            f"UPDATE conversation SET status = 'deleted', updated_at = ? WHERE id IN ({placeholders}) AND status != 'deleted'",
            [now] + ids,  # 参数列表：时间 + 所有 ID
        )  # 批量软删除
        db.commit()  # 提交事务

        return {"ok": True, "deleted_count": cur.rowcount}  # 返回删除数量
    finally:
        db.close()  # 关闭数据库连接
