# HourMind 设计会话上下文存档

**日期**：2026-05-27
**版本**：v2.0（纯 SQLite + Node.js 方案）
**状态**：架构设计统一为 SQLite，已完成的模块有认证/Key管理/对话/仪表盘

---

## 项目概述

HourMind（小时智脑）—— 个人智能系统，定位为"私人第二大脑 + 多模型智能助理"。

**技术栈**：Vue 3 + TypeScript + Vite + Pinia / Node.js + Express + TypeScript + Prisma + SQLite

**UI 风格**：Quantum Glass（量子玻璃）—— 极致玻璃拟态 + 轻科幻 + 主色 `#00E5D8`

---

## 产出文件清单（specs/ 目录）

| 文件 | 内容 |
|------|------|
| `architecture-overview.md` | 12 项横向基础设施（认证/前端全局/Node架构/系统设置/Prisma Schema/种子数据/WS封装/开发工作流/后续扩展） |
| `chat-design.md` | 智能对话模块（4 表 7 action） |
| `api-key-management-design.md` | API Key 管理模块（4 表 7 action） |
| `knowledge-base-design.md` | 个人知识库模块（2 表 9 action，Phase 2） |
| `todo-design.md` | 个人待办模块（2 表 9 action，Phase 2） |
| `history-design.md` | 历史记录模块（5 action，Phase 2） |
| `dashboard-design.md` | 仪表盘模块（1 action） |
| `test-strategy-and-acceptance.md` | 测试策略 + 验收条件 |

**总计：8 份文档**

---

## 架构决策汇总

| 决策点 | 选择 |
|--------|------|
| 平台 | MVP 为纯 Web 应用（localhost） |
| 数据库 | SQLite（单文件），后续可迁移 PostgreSQL + pgvector |
| 前端通信 | 统一 WebSocket（Promise 化封装 `wsClient.send()`） |
| 流式对话 | Node.js 直接调厂商 API，通过 ctx.push() 推前端 |
| Key 安全 | AES-256-GCM 加密，Node.js 端加解密 |
| 认证 | 本地密码 + JWT（24h 有效） |
| 厂商维护 | 数据库存储，Prisma seed 预置 7 家厂商 |
| 模型调用 | 取第一个 active Key，直接调用 |
| 文件存储 | 本地文件系统 `data/knowledge_files/`（知识库 Phase 2） |
| 语义搜索 | Phase 1 使用 SQLite LIKE 关键词匹配 |

---

## 数据库表（当前已实现 8 张）

- `AppConfig` — 系统配置（kv 结构）
- `AiProvider` — AI 厂商
- `ApiKey` — API Key
- `KeyTestLog` — Key 测试记录
- `TokenUsageRecord` — Token 用量
- `Conversation` — 会话
- `Message` — 消息

**Phase 2 规划表：**
- `KnowledgeDocument` — 知识文档
- `KnowledgeCard` — 知识卡片
- `Task` — 任务
- `Subtask` — 子任务

---

## 前端路由（当前已实现 5 条）

```
/            → DashboardView       ✅ 已实现
/chat        → ChatView            ✅ 已实现
/keys        → KeysView            ✅ 已实现
/login       → LoginView           ✅ 已实现
/setup       → SetupView           ✅ 已实现
/history     → HistoryView         待开发
/knowledge   → KnowledgeView       待开发
/tasks       → TasksView           待开发
/settings    → SettingsView        待开发
```

---

## 开发状态

| 模块 | 状态 |
|------|------|
| 项目基础框架 | ✅ 完成 |
| 认证系统 | ✅ 完成 |
| API Key 管理 | ✅ 完成 |
| 智能对话（流式） | ✅ 完成 |
| 仪表盘增强 | ✅ 完成 |
| 历史记录 | 待开发 |
| 系统设置 | 待开发 |
| 个人知识库 | Phase 2 |
| 个人待办 | Phase 2 |

---

## 下一步

继续开发 Phase 1 剩余模块：历史记录 → 设置中心
