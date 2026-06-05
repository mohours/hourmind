# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

HourMind（小时智脑）是一个个人智能系统，定位为"私人第二大脑 + 多模型 AI 助理"。支持多厂商 API Key 统一管理、流式对话、知识库、待办事项等功能。

技术栈：Vue 3 + TypeScript + Vite + Pinia / Node.js + Express + TypeScript + Prisma + SQLite / Python + FastAPI（specs 中规划，当前未实现）

## 开发规范必须遵守
- 每行代码都要写注释

### 后端 (hourmind/server)

```bash
cd hourmind/server
npm install                 # 安装依赖
npx prisma migrate dev      # 数据库迁移（首次必须执行）
npx prisma db seed          # 预置 7 家 AI 厂商数据
npm run dev                 # 启动开发服务器 (tsx watch, 端口 3000)
npm run build               # TypeScript 编译
```

### 前端 (hourmind/client)

```bash
cd hourmind/client
npm install                 # 安装依赖
npm run dev                 # 启动 Vite 开发服务器 (端口 5173)
npm run build               # 生产构建 (vue-tsc -b && vite build)
```

前端 tsconfig 是双文件结构：`tsconfig.json`（app 代码，`@/*` → `src/*`）和 `tsconfig.node.json`（仅编译 `vite.config.ts`），两者通过 `references` 关联。手动类型检查需用 `vue-tsc -b`。

### 种子数据

`npm run db:seed` 预置 7 家 AI 厂商：OpenAI、Anthropic、DeepSeek、Google Gemini、xAI Grok、Moonshot、通义千问。

## 架构核心

### 通信机制：统一 WebSocket

前端与 Node.js 后端通过 WebSocket 通信，采用 **Promise 化的 request-response 模式** + **服务端推送（流式）**：

- **普通请求**：前端 `wsClient.send('keys.list', payload)` → 返回 Promise → 后端返回 `{ id, type: 'response', success, data }`
- **流式推送**：对话场景下，后端通过 `ctx.push('stream_chunk', ...)` 主动推送，不参与 request-response 匹配
- 后端路由分发器 `wsRouter.ts` 通过 `registerRoute(action, handler)` 注册处理函数，`handleMessage(action, payload, token, ws)` 分发
- 前端 `composables/useWs.ts` 封装了全局 WebSocket 单例，支持 `send()`、`onPush()`、`offPush()`

### 后端 Handler 模式

所有业务逻辑以 handler 函数形式组织，签名统一：

```typescript
type Handler = (payload: any, token?: string, ctx?: PushContext) => Promise<WsResponse>
```

- `payload` — 客户端请求参数
- `token` — JWT 认证令牌
- `ctx` — 推送上下文，用于流式场景。`ctx.push(type, data)` 将 data 展开到顶层发送（`{ type, ...data }`），推送帧没有 `id` 字段，不参与 request-response 匹配

### 数据库

- 当前使用 SQLite（文件 `prisma/db/hourmind.db`），specs 中规划未来迁移到 PostgreSQL + pgvector
- 单用户系统，不涉及 RBAC
- 密码用 bcrypt 哈希存在 `AppConfig` 表（key-value 结构）
- API Key 用 AES-256-GCM 加密存储，前端永远只拿到 `keySuffix`（后 6 位）

### 认证流程

1. 首次使用 → `auth.setup` 设置本地密码 → 返回 JWT（24h 有效）
2. 后续打开 → `auth.login` 验证密码 → 返回 JWT
3. 页面刷新 → 前端用 `localStorage` 中的 token 重连 WS → `auth.check` 验证
4. 未认证时显示 `SetupView` / `LoginView`，无导航栏
5. 认证后显示 `AppSidebar`（260px）+ `<router-view />` 主内容区

### 前端路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/setup` | SetupView | 首次设置密码 |
| `/login` | LoginView | 登录 |
| `/` | DashboardView | 仪表盘 |
| `/chat` | ChatView | 对话（含会话列表 + 消息区） |
| `/keys` | KeysView | API Key 管理 |

### 前端 Store 结构

- `appStore` — 全局状态：认证 token、侧边栏、主题设置
- `keyStore` — API Key CRUD + 测试 + 统计
- `chatStore` — 会话列表 + 消息 + 流式输出状态管理

### UI 设计：Quantum Glass（量子玻璃）

- 主色 `#00E5D8`（量子青），背景 `#0A0C12`（深空）
- 全局玻璃拟态效果：`.glass-card` 样式（backdrop-filter blur、半透明背景、辉光边框）
- 全局样式定义在 `client/src/style.css`

## 目录结构要点

```
hourmind/
├── server/
│   ├── src/
│   │   ├── index.ts              # Express + WS 启动（端口 3000）
│   │   ├── db.ts                 # Prisma Client 单例
│   │   ├── wsServer.ts           # WebSocket 服务端（连接管理 + 消息分发）
│   │   ├── wsRouter.ts           # Action 路由分发器（核心：含 PushContext）
│   │   ├── seed.ts               # 预置 AI 厂商数据
│   │   ├── handlers/             # 按模块拆分：authHandler / keyHandler / chatHandler
│   │   └── services/             # cryptoService（AES 加密）/ aiService（厂商 API 调用含流式）
│   └── prisma/schema.prisma     # 数据库 Schema
├── client/
│   ├── src/
│   │   ├── main.ts              # Vue 入口
│   │   ├── App.vue              # 根组件（认证状态决定显示登录页还是布局）
│   │   ├── router.ts            # 前端路由配置
│   │   ├── style.css            # Quantum Glass 全局样式
│   │   ├── composables/useWs.ts # WebSocket 客户端（全局单例，Promise 化）
│   │   ├── stores/              # Pinia stores: appStore / keyStore / chatStore
│   │   ├── views/               # 页面组件: Setup / Login / Dashboard / Keys / Chat
│   │   └── components/          # 通用组件: AppSidebar / KeyCard / AddKeyDialog / ChatMessage 等
│   └── vite.config.ts           # Vite 配置（@ 别名指向 src/，/api 代理到 localhost:3000）
└── plans/                       # MVP 实现计划
specs/                           # 8 份产品设计文档（架构总览 + 各模块详细设计 + 测试策略）
```

## 会话记忆规则

1. **历史查询**：用户询问更早历史时，按日期和关键词搜索 `~/.claude/projects/<项目路径名>/` 下的 `.jsonl` transcript。默认查询范围 30 天内，超出需用户确认。
3. **记忆写入**：
   - **轻量写入**（编码偏好小调整、UI 审美补充）：直接写入 `memory/`，一句告知。
   - **重要写入**（技术决策、行为规则、模块状态变更）：先简要摘要汇报，用户确认后再写入。
   - **用户覆盖**：用户说"别记这个"或"把之前那条改成 X"，立刻执行，不争辩。

## 关键约定

- MVP 阶段为纯 Web 应用（localhost），不考虑 Electron
- 当前只使用 SQLite 数据库，specs 中规划未来迁移到 PostgreSQL + pgvector
- 环境变量在 `hourmind/server/.env`：`JWT_SECRET`、`ENCRYPTION_KEY`、`PORT`
- `index.ts` 顶部调用 `dotenv.config()` 隐式加载 `.env`，所有依赖环境变量的模块（如 `cryptoService`、`authHandler`）必须在 `index.ts` import 链中才生效
- Python AI 服务在 MVP 阶段被简化掉了，Node.js 直接调用厂商 API（`services/aiService.ts` 中的 `streamChat`）
- 所有 handler 的 action 命名遵循 `模块.动词` 格式（如 `keys.list`、`messages.send`）
- 不要暴露 `encryptedKey` 到前端响应中
- 组件文件每行代码都有中文注释（来自 MVP 计划的要求）
