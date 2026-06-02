# server/routes/knowledge.py
# 知识库 REST 端点 —— 知识条目的增删改查，支持按类型筛选和标题+内容搜索，分页返回
import uuid  # UUID 生成
from datetime import datetime, timezone  # UTC 时间

from fastapi import APIRouter, Depends, HTTPException, Query  # FastAPI 路由与参数
from database import get_db  # 数据库连接
from auth import require_auth  # JWT 认证依赖
from models import KnowledgeCreate, KnowledgeUpdate  # Pydantic 模型

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


# ── 知识条目列表（分页 + 筛选 + 搜索）──

@router.get("")
def list_knowledge(
    type: str = Query(None, description="按类型筛选：note / reference / snippet / idea"),  # 类型筛选参数
    search: str = Query(None, description="搜索关键词，匹配标题和内容"),  # 搜索关键词参数
    page: int = Query(1, ge=1, description="页码，从 1 开始"),  # 页码参数
    page_size: int = Query(20, ge=1, le=100, description="每页条数，最大 100"),  # 每页条数参数
    _token: str = Depends(require_auth),  # 认证保护
):
    """列出知识条目 —— 支持按类型筛选、搜索、分页"""
    db = get_db()  # 获取数据库连接
    try:
        # 构建查询条件
        conditions = []  # WHERE 条件列表
        params = []  # 参数列表

        # 按类型筛选
        if type:
            conditions.append("type = ?")
            params.append(type)

        # 搜索标题和内容
        if search:
            conditions.append("(title LIKE ? OR content LIKE ?)")
            like_pattern = f"%{search}%"  # LIKE 通配
            params.append(like_pattern)
            params.append(like_pattern)

        where_clause = ""  # WHERE 子句
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        # ── 查询总数（用于分页）──
        count_sql = f"SELECT COUNT(*) AS total FROM knowledge {where_clause}"
        total = db.execute(count_sql, params).fetchone()["total"]

        # ── 查询分页数据 ──
        offset = (page - 1) * page_size  # 计算偏移量
        data_sql = f"SELECT * FROM knowledge {where_clause} ORDER BY created_at DESC LIMIT ? OFFSET ?"
        rows = db.execute(data_sql, params + [page_size, offset]).fetchall()

        return {
            "items": [dict(row) for row in rows],  # 条目列表
            "total": total,  # 总条目数
            "page": page,  # 当前页码
            "page_size": page_size,  # 每页条数
        }
    finally:
        db.close()  # 确保关闭数据库连接


# ── 获取单个知识条目 ──

@router.get("/{knowledge_id}")
def get_knowledge(knowledge_id: str, _token: str = Depends(require_auth)):
    """获取单个知识条目详情"""
    db = get_db()  # 获取数据库连接
    try:
        row = db.execute(
            "SELECT * FROM knowledge WHERE id = ?", (knowledge_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="知识条目不存在")
        return dict(row)  # 返回条目数据
    finally:
        db.close()  # 确保关闭数据库连接


# ── 创建知识条目 ──

@router.post("", status_code=201)
def create_knowledge(body: KnowledgeCreate, _token: str = Depends(require_auth)):
    """创建新知识条目 —— title 必填，其余选填"""
    db = get_db()  # 获取数据库连接
    try:
        knowledge_id = str(uuid.uuid4())  # 生成 UUID
        now = datetime.now(timezone.utc).isoformat()  # 当前 UTC 时间

        db.execute(
            """INSERT INTO knowledge (id, title, content, type, tags_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                knowledge_id,
                body.title,
                body.content or "",
                body.type or "document",
                body.tags_json or "[]",
                now,
                now,
            ),
        )
        db.commit()  # 提交事务

        # 查回新创建的条目
        row = db.execute(
            "SELECT * FROM knowledge WHERE id = ?", (knowledge_id,)
        ).fetchone()
        return dict(row)  # 返回条目数据
    finally:
        db.close()  # 确保关闭数据库连接


# ── 更新知识条目 ──

@router.put("/{knowledge_id}")
def update_knowledge(
    knowledge_id: str,  # 条目 ID
    body: KnowledgeUpdate,  # 更新字段
    _token: str = Depends(require_auth),  # 认证保护
):
    """更新知识条目字段 —— 只更新传入的非空字段"""
    db = get_db()  # 获取数据库连接
    try:
        # 检查条目是否存在
        existing = db.execute(
            "SELECT id FROM knowledge WHERE id = ?", (knowledge_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="知识条目不存在")

        now = datetime.now(timezone.utc).isoformat()  # 当前 UTC 时间

        # 动态构建 SET 子句 —— 只更新传入的字段
        fields = []  # SET 字段列表
        params = []  # 参数列表

        if body.title is not None:
            fields.append("title = ?")
            params.append(body.title)
        if body.content is not None:
            fields.append("content = ?")
            params.append(body.content)
        if body.summary is not None:
            fields.append("summary = ?")
            params.append(body.summary)
        if body.type is not None:
            fields.append("type = ?")
            params.append(body.type)
        if body.tags_json is not None:
            fields.append("tags_json = ?")
            params.append(body.tags_json)

        if fields:
            fields.append("updated_at = ?")  # 更新时间戳
            params.append(now)
            params.append(knowledge_id)  # WHERE 条件参数
            sql = f"UPDATE knowledge SET {', '.join(fields)} WHERE id = ?"
            db.execute(sql, params)
            db.commit()  # 提交事务

        # 查回更新后的条目
        row = db.execute(
            "SELECT * FROM knowledge WHERE id = ?", (knowledge_id,)
        ).fetchone()
        return dict(row)  # 返回最新数据
    finally:
        db.close()  # 确保关闭数据库连接


# ── 删除知识条目 ──

@router.delete("/{knowledge_id}")
def delete_knowledge(knowledge_id: str, _token: str = Depends(require_auth)):
    """硬删除知识条目"""
    db = get_db()  # 获取数据库连接
    try:
        # 检查条目是否存在
        existing = db.execute(
            "SELECT id FROM knowledge WHERE id = ?", (knowledge_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="知识条目不存在")

        db.execute("DELETE FROM knowledge WHERE id = ?", (knowledge_id,))
        db.commit()  # 提交事务
        return {"ok": True}
    finally:
        db.close()  # 确保关闭数据库连接
