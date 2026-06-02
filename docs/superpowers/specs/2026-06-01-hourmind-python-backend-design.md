# HourMind 技术架构设计文档

> 基于产品 PRD 文档重新设计，2026-06-01

## 一、总体架构概述

本系统采用前后端分离的单用户本地应用架构。整体技术栈分为三层：前端应用、后端服务、数据存储。

- **前端**：使用 Vue 3 + TypeScript + Vite 5 开发，Pinia 状态管理，Hash 路由模式
- **后端服务**：基于 Python 3.12 + FastAPI 构建，HTTP REST + WebSocket 双协议通信
- **数据存储**：使用 SQLite（Python 原生 sqlite3），单文件数据库，零配置部署

### 架构图

```
┌────────────────────────────────────────────────────┐
│                    Vue 3 前端                        │
│  浏览器 (localhost:5173)                             │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐      │
│  │ 增删改查  │  │ 流式聊天  │  │ 系统连接     │      │
│  │ HTTP REST │  │ WebSocket │  │ WebSocket    │      │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘      │
│       │             │               │               │
└───────┼─────────────┼───────────────┼───────────────┘
        │             │               │
        │  HTTP       │  WebSocket    │  WebSocket
        │  /api/*     │  /ws/chat     │  /ws
        │             │               │
┌───────┴─────────────┴───────────────┴───────────────┐
│                  FastAPI 后端                         │
│  服务端 (localhost:8000)                              │
│                                                     │
│  ┌─────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ REST Router │  │ /ws/chat   │  │ /ws        │   │
│  │ /api/*      │  │ 流式对话    │  │ 认证/通知   │   │
│  └──────┬──────┘  └─────┬──────┘  └─────┬──────┘   │
│         │               │               │           │
│  ┌──────┴───────────────┴───────────────┴──────┐   │
│  │              Service 层                      │   │
│  │  auth │ ai_service │ crypto │ search       │   │
│  └──────────────────────┬──────────────────────┘   │
│                         │                           │
│  ┌──────────────────────┴──────────────────────┐   │
│  │          sqlite3 + 手写 SQL                  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 协议分工

| 功能模块 | 协议 | 说明 |
|------|:---:|------|
| 认证 | HTTP REST | 一次性请求 |
| API Key CRUD | HTTP REST | 标准增删改查 |
| 仪表盘统计 | HTTP REST | 简单查询 |
| 会话管理 | HTTP REST | 列表、创建、删除 |
| 历史记录 | HTTP REST | 分页查询、批量操作 |
| 任务管理 | HTTP REST | CRUD + 子任务 |
| 知识库 | HTTP REST | 文档/卡片管理 |
| 聊天消息 | WebSocket | 流式推送 |
| 系统通知 | WebSocket | 主动推送 |

---

## 二、技术栈

### 2.1 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | ^3.5.0 | 响应式组件框架 |
| TypeScript | ^5.6.0 | 类型安全 |
| Vite | ^5.4.0 | 开发服务器与构建工具 |
| Pinia | ^2.2.0 | 全局状态管理 |
| Vue Router | ^4.4.0 | Hash 模式前端路由 |
| marked | ^18.0.4 | Markdown 渲染 |
| highlight.js | ^11.11.1 | 代码语法高亮 |

### 2.2 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.12+ | 运行时 |
| FastAPI | latest | Web 框架（REST + WebSocket） |
| uvicorn | latest | ASGI 服务器 |
| sqlite3 | 内置 | 数据库（零依赖） |
| python-jose | latest | JWT 签发与验证 |
| bcrypt | latest | 密码哈希 |
| cryptography | latest | AES-256-GCM 加密 |
| httpx | latest | 异步 HTTP 客户端（调 AI 厂商 API） |
| python-dotenv | latest | 环境变量加载 |

### 2.3 数据存储

- **主数据库**：SQLite，单文件，Python 内置 sqlite3 模块
- **迁移管理**：手写 `.sql` 文件，按序号命名

---

## 三、项目目录结构

```
hourmind/
├── client/                     # Vue 3 前端（保持不变）
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router.ts
│   │   ├── style.css
│   │   ├── api/                # [新增] HTTP REST 请求封装
│   │   ├── composables/
│   │   │   └── useWs.ts        # WebSocket 客户端
│   │   ├── stores/             # Pinia stores
│   │   ├── views/              # 页面组件
│   │   └── components/         # UI 组件
│   ├── vite.config.ts
│   └── package.json
│
├── server/                     # Python FastAPI 后端（重写）
│   ├── main.py                 # 入口：FastAPI + WebSocket 启动
│   ├── config.py               # 配置（读 .env）
│   ├── database.py             # sqlite3 连接管理
│   ├── auth.py                 # JWT 签发与验证
│   ├── models.py               # Pydantic 数据模型
│   ├── routes/                 # REST API 路由
│   │   ├── __init__.py
│   │   ├── auth.py             # /api/auth/*
│   │   ├── keys.py             # /api/keys/*, /api/providers
│   │   ├── conversations.py    # /api/conversations/*
│   │   ├── tasks.py            # /api/tasks/*
│   │   ├── knowledge.py        # /api/knowledge/*
│   │   ├── dashboard.py        # /api/dashboard
│   │   └── history.py          # /api/history
│   ├── ws/                     # WebSocket 处理
│   │   ├── __init__.py
│   │   ├── chat.py             # /ws/chat  流式对话
│   │   └── system.py           # /ws       系统通知
│   ├── services/               # 业务逻辑
│   │   ├── __init__.py
│   │   ├── ai_service.py       # 调用 AI 厂商 API（流式 SSE）
│   │   ├── crypto_service.py   # AES-256-GCM 加密解密
│   │   └── search_service.py   # 联网搜索
│   ├── db/                     # 数据库
│   │   ├── schema.sql          # 建表语句
│   │   ├── seed.sql            # 预置数据（7 家 AI 厂商）
│   │   └── migrations/         # 迁移脚本
│   ├── requirements.txt        # Python 依赖
│   └── .env
│
├── docs/
│   └── 设计文档/               # PRD 文档
└── CLAUDE.md
```

---

## 四、数据库设计

详见 [HourMind 数据库设计文档](./2026-06-01-hourmind-database-design.md)，包含 7 张表的完整字段定义、JSON 结构说明、建表 SQL 和种子数据。

**表概览：**

| 表名 | 用途 | 说明 |
|------|------|------|
| config | 系统配置 | key-value |
| provider | AI 厂商 | 预置 7 家 |
| api_key | API Key | AES 加密，前端只返回后 6 位 |
| conversation | 对话 | 消息存 JSON，标签存 JSON |
| task | 待办任务 | 支持来源追溯 |
| subtask | 子任务 | 独立表，cascade 删除 |
| knowledge | 知识库 | type 区分 document/card |

---

## 五、REST API 接口设计

### 5.1 认证 — `/api/auth`

| 方法 | 路径 | 请求体 | 返回 |
|------|------|------|------|
| POST | `/api/auth/setup` | `{ password }` | `{ token }` |
| POST | `/api/auth/login` | `{ password }` | `{ token }` |
| GET | `/api/auth/check` | Header: `Authorization: Bearer <token>` | `{ valid: true }` |

### 5.2 API Key — `/api/keys`、`/api/providers`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/providers` | 厂商列表 |
| GET | `/api/keys` | Key 列表（含用量摘要） |
| POST | `/api/keys` | 添加 Key `{ provider_id, key_value, alias }` |
| DELETE | `/api/keys/{id}` | 删除 Key（软删除） |
| PUT | `/api/keys/{id}/toggle` | 启用/禁用 |
| POST | `/api/keys/{id}/test` | 测试连通性，返回 `{ ok, latency_ms, models[] }` |

### 5.3 对话 — `/api/conversations`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/conversations` | 会话列表 `?status=active&page=1` |
| POST | `/api/conversations` | 新建 `{ title, model }` |
| DELETE | `/api/conversations/{id}` | 删除 |
| PUT | `/api/conversations/{id}` | 编辑 `{ title }` |
| GET | `/api/conversations/{id}` | 获取会话详情（含消息） |

### 5.4 任务 — `/api/tasks`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 列表 `?status=todo&priority=high` |
| POST | `/api/tasks` | 创建 |
| PUT | `/api/tasks/{id}` | 更新 |
| DELETE | `/api/tasks/{id}` | 删除 |
| POST | `/api/tasks/{id}/subtasks` | 添加子任务 `{ title }` |
| PUT | `/api/subtasks/{id}/toggle` | 勾选/取消 |
| DELETE | `/api/subtasks/{id}` | 删除子任务 |

### 5.5 知识库 — `/api/knowledge`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge` | 列表 `?type=document&search=关键词` |
| POST | `/api/knowledge` | 创建 `{ title, content, type }` |
| PUT | `/api/knowledge/{id}` | 更新 |
| DELETE | `/api/knowledge/{id}` | 删除 |

### 5.6 仪表盘 & 历史

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard` | 今日概览（Token、对话数、活跃模型） |
| GET | `/api/history` | 历史记录 `?page=1&search=xxx&date_from=...` |
| POST | `/api/history/batch` | 批量操作 `{ ids[], action: "delete"|"export" }` |

---

## 六、WebSocket 通信协议

### 6.1 聊天 WebSocket — `/ws/chat`

**前端发送：**

| action | 说明 | payload |
|------|------|------|
| `send` | 发送消息 | `{ conversation_id, content, model }` |
| `stop` | 停止生成 | `{ conversation_id }` |
| `regenerate` | 重新生成 | `{ conversation_id }` |

**后端推送：**

| type | 说明 | 字段 |
|------|------|------|
| `start` | 开始生成 | `message_id` |
| `chunk` | 文本块 | `message_id, content` |
| `end` | 生成完毕 | `message_id, token_count, model` |
| `error` | 出错 | `message_id, error` |

**流程示例：**

```
客户端 → { "action": "send", "conversation_id": "c1", "content": "你好" }
服务端 ← { "type": "start", "message_id": "msg_001" }
服务端 ← { "type": "chunk", "message_id": "msg_001", "content": "你" }
服务端 ← { "type": "chunk", "message_id": "msg_001", "content": "好" }
服务端 ← { "type": "end", "message_id": "msg_001", "token_count": 8 }
```

### 6.2 系统 WebSocket — `/ws`

| 推送类型 | 说明 |
|------|------|
| `notification` | 任务提醒等 |
| `token_alert` | Token 用量预警 |

---

## 七、安全设计

| 机制 | 实现 |
|------|------|
| 密码存储 | bcrypt 哈希，存于 `config` 表 `password_hash` |
| API Key 存储 | AES-256-GCM 加密（`cryptography` 包） |
| 会话认证 | JWT 24h 有效（`python-jose`） |
| Key 脱敏 | 前端仅返回后 6 位 `key_suffix` |
| 环境变量 | `JWT_SECRET`、`ENCRYPTION_KEY` 通过 `.env` 注入 |

---

## 八、部署与启动

### 8.1 环境要求

| 项目 | 要求 |
|------|------|
| Python | 3.12+ |
| Node.js | 18+ |
| 操作系统 | macOS / Windows / Linux |

### 8.2 后端启动

```bash
cd server
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
sqlite3 data/hourmind.db < db/schema.sql
sqlite3 data/hourmind.db < db/seed.sql
uvicorn main:app --reload --port 8000
```

### 8.3 前端启动

```bash
cd client
npm install
npm run dev
```

### 8.4 Vite 代理配置

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8000',
    '/ws':  { target: 'ws://localhost:8000', ws: true }
  }
}
```

### 8.5 环境变量 (`server/.env`)

```
JWT_SECRET=换成一个随机字符串
ENCRYPTION_KEY=一个32字符的密钥
DATABASE_PATH=data/hourmind.db
PORT=8000
```

---

## 九、Python 依赖清单

```
fastapi
uvicorn[standard]
websockets
python-jose[cryptography]
bcrypt
cryptography
httpx
python-dotenv
```

共 8 个包。

---

## 十、前端路由与 Store 结构（沿用当前设计）

| 路径 | 组件 | 说明 |
|------|------|------|
| `/setup` | SetupView | 首次设置密码 |
| `/login` | LoginView | 登录 |
| `/` | DashboardView | 仪表盘 |
| `/chat` | ChatView | 对话（会话列表 + 消息区） |
| `/keys` | KeysView | API Key 管理 |
| `/history` | HistoryView | 历史记录 |
| `/tasks` | TasksView | 待办事项 |
| `/knowledge` | KnowledgeView | 知识库 |
| `/settings` | SettingsView | 系统设置 |

| Store | 职责 |
|------|------|
| appStore | 认证状态、token |
| keyStore | API Key CRUD |
| chatStore | 会话 + 消息 + 流式状态 |
| dashboardStore | 仪表盘数据 |
| historyStore | 历史记录 |
| taskStore | 任务 + 子任务 |
| knowledgeStore | 知识库 |
| settingsStore | 系统设置 |

---

## 十一、UI 设计规范

- **主题**：Quantum Glass（量子玻璃）
- **主色**：`#00E5D8`（量子青）/ 背景 `#0A0C12`（深空）
- **全局效果**：玻璃拟态（backdrop-filter blur、半透明背景、辉光边框）
- **字体**：Inter / -apple-system
- **圆角**：16px
- **暗黑模式**：强制
