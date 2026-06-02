# server/models.py
# Pydantic 数据模型 —— 认证 + API Key 相关的请求/响应 Schema
from __future__ import annotations  # Python 3.9 兼容 list[str] | None 语法
from pydantic import BaseModel
from typing import Optional


# ── 认证模型 ──

class AuthRequest(BaseModel):
    """认证请求 —— 密码"""
    password: str


class AuthResponse(BaseModel):
    """认证响应 —— JWT Token"""
    token: str


class CheckResponse(BaseModel):
    """Token 检查响应"""
    valid: bool
    setup_required: bool = False


# ── API Key 模型 ──

class KeyCreate(BaseModel):
    """创建 API Key 请求体"""
    provider_id: str          # 关联厂商 ID
    key_value: str            # 明文 Key（后端加密存储）
    alias: str = ""           # 用户自定义别名


class KeyResponse(BaseModel):
    """API Key 列表响应（不暴露 encrypted_key）"""
    id: str
    provider_name: str        # 联表查出的厂商名称
    alias: str
    key_suffix: str           # 后 6 位明文（前端展示）
    status: str               # active / disabled / deleted
    tags: str                 # JSON 数组字符串
    usage: str                # 用量 JSON 字符串
    test_result: str          # 测试历史 JSON 字符串
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TestResult(BaseModel):
    """Key 连通性测试结果"""
    ok: bool
    latency_ms: int
    error: Optional[str] = None
    models: list[str] = []    # 返回可用模型列表


# ── 任务模型 ──

class TaskCreate(BaseModel):
    """创建任务请求体"""
    title: str                                      # 任务标题
    description: Optional[str] = ""                 # 任务描述
    priority: Optional[str] = "medium"              # 优先级：low / medium / high / urgent
    status: Optional[str] = "todo"                  # 状态：todo / in_progress / done
    due_date: Optional[str] = None                  # 截止日期 ISO 字符串
    tags_json: Optional[str] = "[]"                 # 标签 JSON 数组字符串


class TaskUpdate(BaseModel):
    """更新任务请求体 —— 所有字段可选"""
    title: Optional[str] = None                     # 任务标题
    description: Optional[str] = None               # 任务描述
    priority: Optional[str] = None                  # 优先级
    status: Optional[str] = None                    # 状态
    due_date: Optional[str] = None                  # 截止日期
    tags_json: Optional[str] = None                 # 标签 JSON


class SubtaskCreate(BaseModel):
    """创建子任务请求体"""
    title: str                                      # 子任务标题
    sort_order: Optional[int] = 0                   # 排序序号


class SubtaskUpdate(BaseModel):
    """更新子任务请求体 —— 所有字段可选"""
    title: Optional[str] = None                     # 子任务标题
    is_completed: Optional[int] = None              # 是否完成（0 或 1）
    sort_order: Optional[int] = None                # 排序序号


# ── 知识库模型 ──

class KnowledgeCreate(BaseModel):
    """创建知识条目请求体"""
    title: str                                      # 标题
    content: Optional[str] = ""                     # 内容
    type: Optional[str] = "document"                # 类型：note / reference / snippet / idea
    tags_json: Optional[str] = "[]"                 # 标签 JSON 数组字符串


class KnowledgeUpdate(BaseModel):
    """更新知识条目请求体 —— 所有字段可选"""
    title: Optional[str] = None                     # 标题
    content: Optional[str] = None                   # 内容
    summary: Optional[str] = None                   # 摘要
    type: Optional[str] = None                      # 类型
    tags_json: Optional[str] = None                 # 标签 JSON


# ── 对话会话模型 ──

class ConversationCreate(BaseModel):
    """创建会话请求体"""
    title: str = "新对话"       # 会话标题（有默认值）
    model: Optional[str] = None  # 模型标识（可选）


class ConversationUpdate(BaseModel):
    """更新会话请求体 —— 所有字段可选，仅更新传入的字段"""
    title: Optional[str] = None         # 新标题
    is_pinned: Optional[bool] = None    # 是否置顶
    is_starred: Optional[bool] = None   # 是否收藏


class ConversationResponse(BaseModel):
    """会话响应体 —— 不含 messages_json 的列表项"""
    id: str                     # 会话 ID
    title: str                  # 标题
    model: Optional[str] = None  # 模型
    is_pinned: bool = False     # 是否置顶
    is_starred: bool = False    # 是否收藏
    status: str = "active"      # 状态
    summary: Optional[str] = None         # 摘要
    total_tokens: int = 0       # Token 用量
    message_count: int = 0      # 消息条数
    created_at: Optional[str] = None  # 创建时间
    updated_at: Optional[str] = None  # 更新时间
