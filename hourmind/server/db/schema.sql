-- server/db/schema.sql
-- HourMind 数据库建表脚本 —— 7 张表：config、provider、api_key、conversation、task、subtask、knowledge

-- 系统配置表（key-value 存储，如密码哈希、AI 参数等）
CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- AI 厂商表（预置 7 家厂商信息）
CREATE TABLE IF NOT EXISTS provider (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    base_url   TEXT NOT NULL,
    logo_url   TEXT,
    is_active  INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- API Key 表（加密存储用户在各厂商的 Key）
CREATE TABLE IF NOT EXISTS api_key (
    id            TEXT PRIMARY KEY,
    provider_id   TEXT NOT NULL REFERENCES provider(id),
    alias         TEXT,
    encrypted_key TEXT NOT NULL,   -- AES-256-GCM 加密后的 key
    key_suffix    TEXT NOT NULL,   -- key 后 6 位，前端显示用
    tags          TEXT DEFAULT '[]',
    status        TEXT DEFAULT 'active',
    test_result   TEXT DEFAULT '[]',
    usage         TEXT DEFAULT '{"today_tokens":0,"month_tokens":0,"estimated_cost_cents":0}',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
);

-- 对话会话表
CREATE TABLE IF NOT EXISTS conversation (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    model          TEXT,
    messages_json  TEXT DEFAULT '[]',   -- 消息列表 JSON
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

-- 待办任务表
CREATE TABLE IF NOT EXISTS task (
    id                     TEXT PRIMARY KEY,
    title                  TEXT NOT NULL,
    description            TEXT,
    priority               TEXT DEFAULT 'medium',   -- low / medium / high / urgent
    status                 TEXT DEFAULT 'todo',     -- todo / in_progress / done
    due_date               TEXT,
    tags_json              TEXT DEFAULT '[]',
    source                 TEXT DEFAULT 'manual',
    source_conversation_id TEXT,
    created_at             TEXT DEFAULT (datetime('now')),
    updated_at             TEXT DEFAULT (datetime('now'))
);

-- 子任务表（外键关联 task）
CREATE TABLE IF NOT EXISTS subtask (
    id           TEXT PRIMARY KEY,
    task_id      TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    sort_order   INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
);

-- 知识库表（笔记、参考文档、代码片段等）
CREATE TABLE IF NOT EXISTS knowledge (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    content    TEXT,
    summary    TEXT,
    type       TEXT DEFAULT 'document',   -- note / reference / snippet / idea
    tags_json  TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
