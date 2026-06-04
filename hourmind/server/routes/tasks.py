# server/routes/tasks.py
# 任务管理 REST 端点 —— 任务的增删改查 + 子任务管理 + 智能解析
import json  # JSON 解析
import re  # 正则提取
import uuid  # UUID 生成
from datetime import datetime, timezone  # UTC 时间

from fastapi import APIRouter, Depends, HTTPException, Query  # FastAPI 路由与参数
from database import get_db  # 数据库连接
from auth import require_auth  # JWT 认证依赖
from models import TaskCreate, TaskUpdate, SubtaskCreate, SubtaskUpdate  # Pydantic 模型

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


# ── 任务列表 ──

@router.get("")
def list_tasks(
    status: str = Query(None, description="按状态筛选：todo / in_progress / done"),  # 状态筛选参数
    priority: str = Query(None, description="按优先级筛选：low / medium / high / urgent"),  # 优先级筛选参数
    _token: str = Depends(require_auth),  # 认证保护
):
    """列出所有任务 —— 支持可选的状态和优先级筛选，按创建时间降序"""
    db = get_db()  # 获取数据库连接
    try:
        sql = "SELECT * FROM task WHERE 1=1"  # 基础查询
        params = []  # 参数列表

        # 按状态筛选
        if status:
            sql += " AND status = ?"
            params.append(status)
        # 按优先级筛选
        if priority:
            sql += " AND priority = ?"
            params.append(priority)

        sql += " ORDER BY created_at DESC"  # 按创建时间降序
        rows = db.execute(sql, params).fetchall()
        return [dict(row) for row in rows]  # 返回字典列表
    finally:
        db.close()  # 确保关闭数据库连接


# ── 创建任务 ──

@router.post("", status_code=201)
def create_task(body: TaskCreate, _token: str = Depends(require_auth)):
    """创建新任务 —— title 必填，其余选填"""
    db = get_db()  # 获取数据库连接
    try:
        task_id = str(uuid.uuid4())  # 生成 UUID
        now = datetime.now(timezone.utc).isoformat()  # 当前 UTC 时间

        db.execute(
            """INSERT INTO task (id, title, description, priority, status, due_date, tags_json, source, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)""",
            (
                task_id,
                body.title,
                body.description or "",
                body.priority or "medium",
                body.status or "todo",
                body.due_date,
                body.tags_json or "[]",
                now,
                now,
            ),
        )
        db.commit()  # 提交事务

        # 查回新创建的任务
        row = db.execute("SELECT * FROM task WHERE id = ?", (task_id,)).fetchone()
        return dict(row)  # 返回任务数据
    finally:
        db.close()  # 确保关闭数据库连接


# ── 更新任务 ──

@router.put("/{task_id}")
def update_task(task_id: str, body: TaskUpdate, _token: str = Depends(require_auth)):
    """更新任务字段 —— 只更新传入的非空字段"""
    db = get_db()  # 获取数据库连接
    try:
        # 检查任务是否存在
        existing = db.execute("SELECT id FROM task WHERE id = ?", (task_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="任务不存在")

        now = datetime.now(timezone.utc).isoformat()  # 当前 UTC 时间

        # 动态构建 SET 子句 —— 只更新传入的字段
        fields = []  # SET 字段列表
        params = []  # 参数列表

        if body.title is not None:
            fields.append("title = ?")
            params.append(body.title)
        if body.description is not None:
            fields.append("description = ?")
            params.append(body.description)
        if body.priority is not None:
            fields.append("priority = ?")
            params.append(body.priority)
        if body.status is not None:
            fields.append("status = ?")
            params.append(body.status)
        if body.due_date is not None:
            fields.append("due_date = ?")
            params.append(body.due_date)
        if body.tags_json is not None:
            fields.append("tags_json = ?")
            params.append(body.tags_json)

        if fields:
            fields.append("updated_at = ?")  # 更新时间戳
            params.append(now)
            params.append(task_id)  # WHERE 条件参数
            sql = f"UPDATE task SET {', '.join(fields)} WHERE id = ?"
            db.execute(sql, params)
            db.commit()  # 提交事务

        # 查回更新后的任务
        row = db.execute("SELECT * FROM task WHERE id = ?", (task_id,)).fetchone()
        return dict(row)  # 返回最新数据
    finally:
        db.close()  # 确保关闭数据库连接


# ── 删除任务（硬删除）──

@router.delete("/{task_id}")
def delete_task(task_id: str, _token: str = Depends(require_auth)):
    """硬删除任务 —— 级联删除子任务（通过 ON DELETE CASCADE）"""
    db = get_db()  # 获取数据库连接
    try:
        # 检查任务是否存在
        existing = db.execute("SELECT id FROM task WHERE id = ?", (task_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="任务不存在")

        db.execute("DELETE FROM task WHERE id = ?", (task_id,))
        db.commit()  # 提交事务
        return {"ok": True}
    finally:
        db.close()  # 确保关闭数据库连接


# ── 创建子任务 ──

@router.post("/{task_id}/subtasks", status_code=201)
def create_subtask(task_id: str, body: SubtaskCreate, _token: str = Depends(require_auth)):
    """为指定任务创建子任务"""
    db = get_db()  # 获取数据库连接
    try:
        # 检查父任务是否存在
        existing = db.execute("SELECT id FROM task WHERE id = ?", (task_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="父任务不存在")

        subtask_id = str(uuid.uuid4())  # 生成子任务 UUID
        now = datetime.now(timezone.utc).isoformat()  # 当前 UTC 时间

        db.execute(
            """INSERT INTO subtask (id, task_id, title, is_completed, sort_order, created_at)
               VALUES (?, ?, ?, 0, ?, ?)""",
            (subtask_id, task_id, body.title, body.sort_order or 0, now),
        )
        db.commit()  # 提交事务

        # 查回新创建的子任务
        row = db.execute("SELECT * FROM subtask WHERE id = ?", (subtask_id,)).fetchone()
        return dict(row)  # 返回子任务数据
    finally:
        db.close()  # 确保关闭数据库连接


# ── 更新子任务（切换完成状态 / 修改标题）──

@router.put("/{task_id}/subtasks/{sub_id}")
def update_subtask(
    task_id: str,  # 父任务 ID
    sub_id: str,  # 子任务 ID
    body: SubtaskUpdate,  # 更新字段
    _token: str = Depends(require_auth),  # 认证保护
):
    """更新子任务 —— 切换 is_completed、修改 title、调整 sort_order"""
    db = get_db()  # 获取数据库连接
    try:
        # 检查子任务是否存在且属于该父任务
        existing = db.execute(
            "SELECT id FROM subtask WHERE id = ? AND task_id = ?",
            (sub_id, task_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="子任务不存在")

        # 动态构建 SET 子句 —— 只更新传入的字段
        fields = []  # SET 字段列表
        params = []  # 参数列表

        if body.title is not None:
            fields.append("title = ?")
            params.append(body.title)
        if body.is_completed is not None:
            fields.append("is_completed = ?")
            params.append(body.is_completed)
        if body.sort_order is not None:
            fields.append("sort_order = ?")
            params.append(body.sort_order)

        if fields:
            params.append(sub_id)  # WHERE 条件参数
            sql = f"UPDATE subtask SET {', '.join(fields)} WHERE id = ?"
            db.execute(sql, params)
            db.commit()  # 提交事务

        # 查回更新后的子任务
        row = db.execute("SELECT * FROM subtask WHERE id = ?", (sub_id,)).fetchone()
        return dict(row)  # 返回最新数据
    finally:
        db.close()  # 确保关闭数据库连接


# ── 删除子任务 ──

@router.delete("/{task_id}/subtasks/{sub_id}")
def delete_subtask(
    task_id: str,  # 父任务 ID
    sub_id: str,  # 子任务 ID
    _token: str = Depends(require_auth),  # 认证保护
):
    """删除子任务"""
    db = get_db()  # 获取数据库连接
    try:
        # 检查子任务是否存在且属于该父任务
        existing = db.execute(
            "SELECT id FROM subtask WHERE id = ? AND task_id = ?",
            (sub_id, task_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="子任务不存在")

        db.execute("DELETE FROM subtask WHERE id = ?", (sub_id,))
        db.commit()  # 提交事务
        return {"ok": True}
    finally:
        db.close()  # 确保关闭数据库连接


# ── 智能解析 ──

@router.post("/parse")
def parse_task_text(body: dict, _token: str = Depends(require_auth)):
    """
    智能解析粘贴的文本 → AI 提取标题/优先级/日期
    输入: { "text": "粘贴的原始文本" }
    输出: { "title": "...", "priority": "...", "due_date": "..." }
    """
    import httpx  # HTTP 客户端（延迟导入，避免全局依赖）
    from services.crypto_service import decrypt  # API Key 解密

    raw_text = body.get("text", "").strip()  # 获取粘贴文本
    if not raw_text:
        raise HTTPException(status_code=400, detail="文本不能为空")

    db = get_db()  # 获取数据库连接
    try:
        # ── 查活跃 API Key ──
        key_row = db.execute("""
            SELECT ak.encrypted_key, p.base_url
            FROM api_key ak
            INNER JOIN provider p ON p.id = ak.provider_id
            WHERE ak.status = 'active'
            ORDER BY ak.updated_at DESC
            LIMIT 1
        """).fetchone()

        if not key_row:
            raise HTTPException(status_code=400, detail="请先在 Key 管理中添加并激活一个 API Key")

        # ── 解密 Key ──
        try:
            plain_key = decrypt(key_row["encrypted_key"])
        except Exception:
            raise HTTPException(status_code=500, detail="API Key 解密失败")

        base_url = key_row["base_url"].rstrip("/")

        # ── 构造 AI 请求 ──
        system_prompt = (
            "你是一个任务解析助手。分析用户输入的文本，提取任务的标题、优先级和截止日期。"
            "只返回 JSON，不要其他内容。格式："
            '{"title":"任务标题","priority":"low/medium/high/urgent","due_date":"ISO日期或null"}'
            "优先级判断：含\"紧急/立即/截止/马上\"→urgent，含\"会议/周会/汇报/重要/必须\"→high，普通→medium，无明确时限→low"
            "日期提取：识别文本中的日期时间，转为 ISO 格式(如2026-05-29T08:45)，无法识别则填 null"
        )

        payload = {
            "model": "deepseek-chat",  # DeepSeek 解析（便宜且中文好）
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": raw_text},
            ],
            "temperature": 0.1,  # 低温度，确保输出稳定
        }

        # ── 调用 AI ──
        try:
            resp = httpx.post(
                f"{base_url}/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {plain_key}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"AI 服务返回错误: HTTP {resp.status_code}")

            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()

            # ── 正则提取 JSON ──
            match = re.search(r'\{[^}]+\}', content)
            if not match:
                raise HTTPException(status_code=500, detail=f"AI 返回格式异常: {content[:200]}")

            parsed = json.loads(match.group())
            return {
                "title": parsed.get("title", ""),
                "priority": parsed.get("priority", "medium"),
                "due_date": parsed.get("due_date"),
            }
        except HTTPException:
            raise  # 原样抛出 FastAPI 异常
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI 调用失败: {str(e)}")
    finally:
        db.close()
