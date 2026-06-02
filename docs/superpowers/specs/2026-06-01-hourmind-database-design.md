# HourMind 数据库设计文档

> 基于产品 PRD 设计，2026-06-01

## 一、数据库概述

- **数据库**：SQLite
- **驱动**：Python 内置 sqlite3 模块
- **迁移管理**：手写 `.sql` 文件，按序号命名，放在 `server/db/migrations/` 目录
- **表数量**：7 张

---

## 二、表设计

### 1. config — 系统配置

键值对存储，密码哈希、系统设置项都放这。

| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT PK | 配置键 |
| value | TEXT | 配置值 |

预置键：`password_hash`、`settings`

---

### 2. provider — AI 厂商

预置 7 家厂商，用 upsert 保证幂等。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 厂商名称 |
| slug | TEXT UNIQUE | 标识符（openai, anthropic...） |
| base_url | TEXT | API 地址 |
| logo_url | TEXT | Logo 图 URL |
| is_active | INTEGER | 0/1 |
| created_at | TEXT | ISO 时间 |

预置数据：

| name | slug | base_url |
|------|------|------|
| OpenAI | openai | https://api.openai.com/v1 |
| Anthropic | anthropic | https://api.anthropic.com |
| DeepSeek | deepseek | https://api.deepseek.com/v1 |
| Google Gemini | gemini | https://generativelanguage.googleapis.com/v1beta |
| xAI Grok | grok | https://api.x.ai/v1 |
| Moonshot | moonshot | https://api.moonshot.cn/v1 |
| 通义千问 | qwen | https://dashscope.aliyuncs.com/compatible-mode/v1 |

---

### 3. api_key — 用户 API Key

AES-256-GCM 加密存储，前端仅返回后 6 位明文。测试记录和用量统计用 JSON 存，避免额外建表。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| provider_id | TEXT FK → provider.id | 关联厂商 |
| alias | TEXT | 用户自定义别名 |
| encrypted_key | TEXT | AES-256-GCM 密文 |
| key_suffix | TEXT | 明文后 6 位（前端展示） |
| tags | TEXT | 标签 JSON 数组 |
| status | TEXT | active / disabled / deleted |
| test_result | TEXT | 测试记录 JSON |
| usage | TEXT | 用量 JSON |
| created_at | TEXT | ISO 时间 |
| updated_at | TEXT | ISO 时间 |

test_result JSON 结构（保留最近 7 次）：

```json
[
  {
    "time": "2026-06-01T10:00:00Z",
    "success": true,
    "latency_ms": 320,
    "error": null
  }
]
```

usage JSON 结构：

```json
{
  "today_tokens": 15000,
  "month_tokens": 300000,
  "estimated_cost_cents": 45
}
```

---

### 4. conversation — 对话会话

消息不单独建表，存在 messages_json 中。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 会话标题（AI 自动生成或用户编辑） |
| model | TEXT | 使用的模型 |
| messages_json | TEXT | 消息列表 JSON |
| tags_json | TEXT | 标签 JSON 数组 |
| is_pinned | INTEGER | 0/1 置顶 |
| is_starred | INTEGER | 0/1 星标 |
| status | TEXT | active / archived / deleted |
| summary | TEXT | AI 生成的会话摘要 |
| total_tokens | INTEGER | 总 Token 消耗 |
| message_count | INTEGER | 消息条数 |
| created_at | TEXT | ISO 时间 |
| updated_at | TEXT | ISO 时间 |

messages_json 结构：

```json
[
  {
    "id": "msg_001",
    "role": "user",
    "content": "你好",
    "created_at": "2026-06-01T10:00:00Z"
  },
  {
    "id": "msg_002",
    "role": "assistant",
    "content": "你好！有什么可以帮你的？",
    "model": "deepseek-v4",
    "token_count": 8,
    "created_at": "2026-06-01T10:00:02Z"
  }
]
```

---

### 5. task — 待办任务

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 任务标题 |
| description | TEXT | 详细描述 |
| priority | TEXT | high / medium / low |
| status | TEXT | todo / in_progress / done |
| due_date | TEXT | 截止日期（ISO 日期） |
| tags_json | TEXT | 标签 JSON 数组 |
| source | TEXT | 来源：manual / chat（手动创建 / 对话提取） |
| source_conversation_id | TEXT | 来源会话 ID（可为空） |
| created_at | TEXT | ISO 时间 |
| updated_at | TEXT | ISO 时间 |

---

### 6. subtask — 子任务

独立建表，方便单独勾选和排序。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| task_id | TEXT FK → task.id | 关联父任务 |
| title | TEXT | 子任务标题 |
| is_completed | INTEGER | 0/1 |
| sort_order | INTEGER | 排序序号 |
| created_at | TEXT | ISO 时间 |

---

### 7. knowledge — 知识库

文档和卡片合并为一张表，用 type 字段区分。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 标题 |
| content | TEXT | 正文内容 |
| summary | TEXT | AI 摘要 |
| type | TEXT | document / card |
| tags_json | TEXT | 标签 JSON 数组 |
| created_at | TEXT | ISO 时间 |
| updated_at | TEXT | ISO 时间 |

---

## 三、建表 SQL

```sql
-- server/db/schema.sql

CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    base_url   TEXT NOT NULL,
    logo_url   TEXT,
    is_active  INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_key (
    id            TEXT PRIMARY KEY,
    provider_id   TEXT NOT NULL REFERENCES provider(id),
    alias         TEXT,
    encrypted_key TEXT NOT NULL,
    key_suffix    TEXT NOT NULL,
    tags          TEXT DEFAULT '[]',
    status        TEXT DEFAULT 'active',
    test_result   TEXT DEFAULT '[]',
    usage         TEXT DEFAULT '{"today_tokens":0,"month_tokens":0,"estimated_cost_cents":0}',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    model          TEXT,
    messages_json  TEXT DEFAULT '[]',
    tags_json      TEXT DEFAULT '[]',
    is_pinned      INTEGER DEFAULT 0,
    is_starred     INTEGER DEFAULT 0,
    status         TEXT DEFAULT 'active',
    summary        TEXT,
    total_tokens   INTEGER DEFAULT 0,
    message_count  INTEGER DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task (
    id                     TEXT PRIMARY KEY,
    title                  TEXT NOT NULL,
    description            TEXT,
    priority               TEXT DEFAULT 'medium',
    status                 TEXT DEFAULT 'todo',
    due_date               TEXT,
    tags_json              TEXT DEFAULT '[]',
    source                 TEXT DEFAULT 'manual',
    source_conversation_id TEXT,
    created_at             TEXT DEFAULT (datetime('now')),
    updated_at             TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subtask (
    id           TEXT PRIMARY KEY,
    task_id      TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    sort_order   INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    content    TEXT,
    summary    TEXT,
    type       TEXT DEFAULT 'document',
    tags_json  TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

## 四、种子数据 SQL

```sql
-- server/db/seed.sql

INSERT OR IGNORE INTO provider (id, name, slug, base_url, is_active) VALUES
  ('p1', 'OpenAI',       'openai',     'https://api.openai.com/v1',                              1),
  ('p2', 'Anthropic',    'anthropic',  'https://api.anthropic.com',                              1),
  ('p3', 'DeepSeek',     'deepseek',   'https://api.deepseek.com/v1',                            1),
  ('p4', 'Google Gemini','gemini',     'https://generativelanguage.googleapis.com/v1beta',        1),
  ('p5', 'xAI Grok',     'grok',       'https://api.x.ai/v1',                                    1),
  ('p6', 'Moonshot',     'moonshot',   'https://api.moonshot.cn/v1',                             1),
  ('p7', '通义千问',     'qwen',       'https://dashscope.aliyuncs.com/compatible-mode/v1',      1);
```
