# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

HourMind（小时智脑）是一个个人智能系统，定位为"私人第二大脑 + 多模型 AI 助理"。支持多厂商 API Key 统一管理、流式对话、知识库、待办事项、仪表盘等功能。

技术栈：Vue 3 + TypeScript + Vite + Pinia / Python 3 + FastAPI / SQLite (sqlite3，手写 SQL)

## 开发规范必须遵守
- 每行代码都要写注释

## 启动命令

### 后端 (hourmind/server)

```bash
cd hourmind/server
python3 -m venv venv && source venv/bin/activate  # 首次创建虚拟环境
pip install -r requirements.txt                    # 安装依赖
python main.py                                     # 启动 (uvicorn, 端口 8000, --reload)
```

数据库初始化在 `main.py` 的 `lifespan` 中自动完成（建表 + 种子数据），无需手动执行迁移。

### 前端 (hourmind/client)

```bash
cd hourmind/client
npm install                 # 安装依赖
npm run dev                 # 启动 Vite 开发服务器 (端口 5173)
npm run build               # 生产构建 (vue-tsc -b && vite build)
```

前端 tsconfig 是双文件结构：`tsconfig.app.json`（app 代码，`@/*` → `src/*`）和 `tsconfig.node.json`（仅编译 `vite.config.ts`），两者通过 `references` 关联。手动类型检查需用 `vue-tsc -b`。

### 种子数据

后端启动时自动执行 `db/schema.sql`（建表）+ `db/seed.sql`（预置 7 家 AI 厂商：OpenAI、Anthropic、DeepSeek、Google Gemini、xAI Grok、Moonshot、通义千问）。

## 架构核心

### 通信机制：REST + WebSocket

前端与后端通过两种方式通信：

- **REST API**：CRUD 操作（认证、Key 管理、会话管理、任务、知识库、仪表盘、设置），前端 `api()` 函数封装 fetch，Vite 开发服务器代理 `/api` 到 `localhost:8000`
- **WebSocket**：仅用于流式聊天的逐块推送 (`/ws/chat`)。客户端先发 `{"type":"auth","token":"..."}` 认证，再发 `{"type":"send",...}` 触发流式生成，服务端逐帧推送 `{"type":"chunk","content":"..."}`。支持 `{"type":"cancel"}` 中断

### 后端路由结构

所有业务模块以 FastAPI `APIRouter` 形式组织，在 `main.py` 中统一注册。路由文件在 `routes/` 目录下：

| 文件 | 前缀 | 职责 |
|------|------|------|
| `routes/auth.py` | `/api/auth` | 密码设置/登录，JWT 签发 |
| `routes/keys.py` | `/api/keys` | API Key CRUD + 连接测试 |
| `routes/conversations.py` | `/api/conversations` | 会话 CRUD |
| `routes/chat_ws.py` | `/ws/chat` | WebSocket 流式对话 |
| `routes/dashboard.py` | `/api/dashboard` | 仪表盘数据聚合 |
| `routes/tasks.py` | `/api/tasks` | 待办事项 + 子任务 CRUD |
| `routes/knowledge.py` | `/api/knowledge` | 知识卡片 CRUD + 搜索 |
| `routes/settings.py` | `/api/settings` | 系统配置 + 数据导入导出 |

通用服务抽取到 `services/`：`ai_service.py`（多厂商 OpenAI-compatible 流式调用）、`crypto_service.py`（AES-256-GCM 加解密）。

### 数据库

- SQLite，文件 `data/hourmind.db`，7 张表：`config`、`provider`、`api_key`、`conversation`、`task`、`subtask`、`knowledge`
- 用 Python 内置 `sqlite3` 模块，手写 SQL（无 ORM），`database.py` 提供 `get_db()` 获取连接
- WAL 模式 + 外键约束开启
- `config` 表是 key-value 结构，存储密码 bcrypt 哈希等
- API Key 用 AES-256-GCM 加密存储，`key_suffix` 存后 6 位明文供前端显示
- 单用户系统，无 RBAC

### 认证流程

1. 首次使用 → `POST /api/auth/setup` 设置本地密码 → 返回 JWT（24h 有效）
2. 后续打开 → `POST /api/auth/login` 验证密码 → 返回 JWT
3. 页面刷新 → 前端用 `localStorage` 中的 token 调 `/api/auth/check` 验证
4. 未认证时 `App.vue` 渲染 `SetupView` / `LoginView`，无侧边栏
5. 认证后显示 `AppSidebar` + `<router-view />` 主内容区
6. REST 接口通过 `require_auth` 依赖注入（从 `Authorization: Bearer <token>` 头提取 JWT），WebSocket 在第一条消息中带 token

### 前端路由 (Hash 模式)

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | DashboardView | 仪表盘（数据概览 + 最近对话） |
| `/chat` | ChatView | 对话（会话列表 + 消息区 + 流式） |
| `/keys` | KeysView | API Key 管理（玻璃卡片列表 + 添加弹窗） |
| `/tasks` | TasksView | 待办事项（CRUD + 子任务 + 筛选） |
| `/knowledge` | KnowledgeView | 知识库（2 列卡片网格 + 搜索） |
| `/history` | HistoryView | 历史记录浏览 |
| `/settings` | SettingsView | 系统设置（模型/外观/数据/关于） |

`/setup` 和 `/login` 不由 Vue Router 管理，由 `App.vue` 根据认证状态直接渲染。

### 前端 Store (Pinia)

- `appStore` — 全局状态：认证 token、侧边栏折叠、主题
- `keyStore` — API Key CRUD + 测试 + 使用量统计
- `chatStore` — 会话列表 + 消息 + WebSocket 流式状态管理
- `taskStore` — 待办事项 CRUD + 子任务 + 筛选排序
- `knowledgeStore` — 知识卡片 CRUD + 搜索 + 筛选
- `settingsStore` — 系统设置读写 + 数据导入导出

### UI 设计：Quantum Glass（量子玻璃）

- 主色 `#00E5D8`（量子青），背景 `#0A0C12`（深空）
- 全局玻璃拟态：`.glass-card`（backdrop-filter blur、半透明背景、辉光边框）
- 自定义渐变滚动条（蓝紫系）
- 全局样式定义在 `client/src/style.css`

## 目录结构

```
hourmind/
├── server/
│   ├── main.py              # FastAPI 入口（端口 8000，lifespan 自动初始化 DB）
│   ├── config.py            # 从 .env 加载 JWT_SECRET / ENCRYPTION_KEY / DATABASE_PATH / PORT
│   ├── database.py          # sqlite3 连接管理（get_db + init_db）
│   ├── auth.py              # JWT 创建/验证 + require_auth 依赖注入
│   ├── models.py            # Pydantic 数据模型
│   ├── db/schema.sql        # 建表脚本（7 张表）
│   ├── db/seed.sql          # 种子数据（7 家 AI 厂商）
│   ├── routes/              # FastAPI Router 模块（auth / keys / conversations / chat_ws / dashboard / tasks / knowledge / settings）
│   └── services/            # ai_service（流式 LLM 调用）/ crypto_service（AES 加密）
├── client/
│   ├── src/
│   │   ├── main.ts          # Vue 入口（挂载 Pinia + Router + 全局样式）
│   │   ├── App.vue          # 根组件（根据认证状态切换 Setup/Login 或主布局）
│   │   ├── router.ts        # Hash 路由（7 个页面路由，懒加载）
│   │   ├── style.css        # Quantum Glass 全局样式 + 渐变滚动条
│   │   ├── api/index.ts     # REST API 封装（fetch + Bearer token）
│   │   ├── stores/          # Pinia: app / key / chat / task / knowledge / settings
│   │   └── views/           # 页面组件: Setup / Login / Dashboard / Chat / Keys / Tasks / Knowledge / History / Settings
│   └── vite.config.ts       # Vite 配置（@ 别名，/api → 8000，/ws → ws://8000）
└── docs/                    # 产品设计文档 + superpowers specs/plans
```

## 记忆系统

记忆分两级：

| 级别 | 路径 | 加载方式 | 内容 |
|------|------|---------|------|
| 用户级 | `.claude/rules/` | 每次会话自动加载 | 用户画像、编码偏好、行为准则、SOP、环境工具。跨项目通用 |
| 项目级 | `.claude/memory/` | 按需查阅（grep） | 项目业务功能索引、技术决策、变更历史。仅本项目管理用 |

### 记忆写入规则

**自动写入**（从日常会话观察，直接记录，一句告知，不追问）：
- 代码风格偏好、UI 审美倾向 → `rules/USER.md`
- 沟通偏好、交付习惯 → `rules/USER.md`
- 行为规则 → `rules/SOUL.md`
- 环境/工具变化 → `rules/TOOLS.md`

**确认后写入**（先简要摘要，用户点头后再写）：
- 重大技术选型、架构决策 → `memory/tech-decisions.md`
- 项目业务功能变更、模块状态 → `memory/business-index.md`

**用户覆盖**：说"别记"/"改成 X" → 立刻执行，不争辩。

### 记忆闭环

- 从对话中观察到的用户偏好/性格 → 自动记录，事后告知
- 重大决策 → 当场确认后记录
- 用户说结束信号（下班了/再见/结束）→ 退场前回顾本次有无遗漏

## 关键约定

- MVP 阶段为纯 Web 应用（localhost），不考虑 Electron
- 当前只使用 SQLite，手写 SQL（sqlite3），不用 ORM
- 环境变量在 `hourmind/server/.env`：`JWT_SECRET`、`ENCRYPTION_KEY`、`PORT`、`DATABASE_PATH`
- `config.py` 顶部调用 `load_dotenv()` 隐式加载 `.env`，所有依赖环境变量的模块必须在其 import 链中才生效
- 不要暴露 `encrypted_key` 到前端响应中
- 前端 `api/index.ts` 的 `BASE` 常量在 dev 模式下通过 Vite 代理转发，生产环境需 Nginx 配合
