# HourMind 项目记忆

- [对话日志](memory/conversations/) — 按月归档，每日一个文件
- [业务功能索引](memory/business-index.md) — 模块业务描述、代码位置、变更历史，从出生到死亡
- [编码偏好](memory/coding-preferences.md) — 代码风格、沟通偏好、交付习惯，用于产出符合用户习惯的代码
- [项目概述](memory/project-overview.md) — HourMind（小时智脑）个人智能系统，已从 Node.js 切换到 Python FastAPI + sqlite3
- [跨会话记忆偏好](memory/cross-session-memory.md) — 用户希望会话关闭前自动总结存档，下次能回顾之前内容
- [文档输出偏好](memory/doc-output-preference.md) — 架构文档类输出写为 md 文件，不直接打印控制台
- [技术选型决策](memory/tech-decisions.md) — 2026-06-01 确定 Python FastAPI + REST/WebSocket + sqlite3，含完整文档索引
- [Memory 格式规范](memory/memory-format.md) — 所有 memory 文件 frontmatter 必须包含 created_at/updated_at 时间戳
- [会话记录归档规则](memory/conversation-archive-rules.md) — 会话结束时存档：用户全文记录、Claude 一行摘要，存入 memory/conversations/
