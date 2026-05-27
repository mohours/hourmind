# HourMind — 系统架构总览

**日期**：2026-05-27
**版本**：v2.0（纯 SQLite + Node.js 方案）
**说明**：本文档描述 HourMind 的横向基础设施。MVP 阶段全部使用 SQLite + Node.js，不依赖 PostgreSQL/pgvector/Python。

---

## 1. 认证与鉴权体系

### 设计原则

个人单用户系统，不引入 RBAC。密码本地存储，JWT 鉴权。

### 流程

```
首次启动 → 设置本地密码 → 密码哈希存 AppConfig
每次打开 → 输入密码 → 后端验证 → 返回 JWT Token（24h 有效）
所有 WebSocket 连接 → ws://host:3000/ws?token=xxx
```

### 数据表：`AppConfig`

| 字段 | 类型 | 说明 |
|------|------|------|
| key | String @id | 配置键 |
| value | String | 配置值 |

### WebSocket action

| action | 说明 |
|--------|------|
| `auth.setup` | 首次设置密码 |
| `auth.login` | 密码验证 → 返回 Token |
| `auth.check` | 验证 Token 是否有效 |

### Token 策略

- JWT，签名密钥来自环境变量 `JWT_SECRET`
- 24 小时过期
- 存储在 localStorage
- Node.js wsAuth 中间件校验，无效则拒绝连接

---

## 2. 前端全局架构

### 完整路由表

```
/                           → DashboardView.vue
/chat                       → ChatView.vue          (空状态)
/keys                       → KeysView.vue
/history                    → HistoryView.vue       (Phase 2)
/knowledge                  → KnowledgeView.vue     (Phase 2)
/tasks                      → TasksView.vue         (Phase 2)
/settings                   → SettingsView.vue      (Phase 2)
/login                      → LoginView.vue         (未认证，无导航栏)
/setup                      → SetupView.vue         (首次设置密码，无导航栏)
```

### 全局 Layout

```
App.vue
  ├── LoginView / SetupView              (未认证时)
  └── (已认证时)
      ├── AppSidebar.vue                 (左侧导航，260px，全局常驻)
      ├── <router-view />               (中间主内容区，自适应)
```

### 导航菜单（MVP 已实现）

```
📊 仪表盘          → /
💬 智能对话         → /chat
🔑 API Key 管理    → /keys
```

### 全局 Store：`useAppStore`

```typescript
interface AppStoreState {
  isAuthenticated: boolean
  token: string | null
  isSetupRequired: boolean
}

// Actions
//   login(password) / setup(password) / logout()
//   checkAuth() → 页面刷新时验证 Token
```

### WebSocket 连接管理

```
App.vue mounted:
  if (token exists):
    连接 ws://localhost:3000/ws?token=xxx
    单条 WebSocket 处理所有通信（请求-响应 + 流式推送）
```

---

## 3. Node.js 服务内部架构

### 目录结构（当前实现）

```
server/
  ├── src/
  │   ├── index.ts                  # 入口：Express + WebSocket（端口 3000）
  │   ├── db.ts                     # Prisma Client 单例
  │   ├── wsServer.ts               # WebSocket 服务创建 + 连接管理
  │   ├── wsRouter.ts               # Action 路由分发器（核心：含 PushContext）
  │   ├── seed.ts                   # 预置 AI 厂商数据
  │   ├── handlers/
  │   │   ├── authHandler.ts        # auth.setup / auth.login / auth.check
  │   │   ├── keyHandler.ts         # keys.* / providers.*
  │   │   ├── chatHandler.ts        # conversations.* / messages.*
  │   │   └── dashboardHandler.ts   # dashboard.summary
  │   └── services/
  │       ├── cryptoService.ts      # AES-256-GCM 加密解密
  │       └── aiService.ts          # 厂商 API 调用（含流式）
  └── prisma/
      ├── schema.prisma             # 数据库 Schema（SQLite）
      ├── db/                       # SQLite 数据库文件
      └── migrations/               # Prisma 迁移记录
```

### wsRouter —— 核心分发

```typescript
type Handler = (payload: any, token?: string, ctx?: PushContext) => Promise<WsResponse>
type WsResponse = { success: boolean; data?: any; error?: { code: string; message: string } }

// PushContext：handler 通过 ctx.push() 向客户端主动推送消息（流式对话用）
// Action → Handler 一一映射，通过 registerRoute('action.name', handler) 注册
```

### 请求处理流程

```
1. WebSocket 收到 { id, type: 'request', action, payload }
2. wsServer 验证 token
3. wsRouter.handleMessage() 根据 action 找到 handler
4. handler 执行业务逻辑（查 DB / 调厂商 API）
5. 返回 { id, type: 'response', success, data/error } 帧
```

### 流式对话流程

```
1. 前端发 messages.send → handler 立即返回 { mode: 'stream', ... }
2. handler 内部异步调 streamChat()（Node.js 直接调厂商 API）
3. 厂商逐 token 推送 → 通过 ctx.push('stream_chunk', ...) 实时推前端
4. 流结束 → ctx.push('stream_end', ...) → 更新数据库
```

---

## 4. 系统设置模块（Phase 2）

### 数据模型

复用 `AppConfig` 表（kv 结构）：

| key | 示例 value | 说明 |
|-----|-----------|------|
| `default_model` | `deepseek-v4-pro` | 默认 AI 模型 |
| `temperature` | `0.7` | 模型温度参数 |
| `particle_bg` | `true` | 粒子背景开关 |
| `glow_intensity` | `medium` | 辉光强度 |

### WebSocket action

| action | 说明 |
|--------|------|
| `settings.get` | 获取所有设置 |
| `settings.update` | 批量更新设置 |

---

## 5. 完整 Prisma Schema（SQLite）

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./db/hourmind.db"
}

// ============ Auth & Config ============
model AppConfig {
  key   String @id
  value String
}

// ============ AI Providers & Keys ============
model AiProvider {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  baseUrl   String
  logoUrl   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  apiKeys   ApiKey[]
}

model ApiKey {
  id           String    @id @default(uuid())
  providerId   String
  provider     AiProvider @relation(fields: [providerId], references: [id])
  alias        String
  encryptedKey String
  keySuffix    String
  tags         String    @default("[]")
  status       String    @default("active")
  isDeleted    Boolean   @default(false)
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  testLogs     KeyTestLog[]
  usageRecords TokenUsageRecord[]
}

model KeyTestLog {
  id           String   @id @default(uuid())
  keyId        String
  key          ApiKey   @relation(fields: [keyId], references: [id])
  isSuccess    Boolean
  latencyMs    Int
  errorMessage String?
  testedAt     DateTime @default(now())
}

model TokenUsageRecord {
  id                 String   @id @default(uuid())
  keyId              String
  key                ApiKey   @relation(fields: [keyId], references: [id])
  modelName          String
  promptTokens       Int
  completionTokens   Int
  estimatedCostCents Int      @default(0)
  recordedAt         DateTime @default(now())
  sessionId          String?
}

// ============ Chat ============
model Conversation {
  id           String    @id @default(uuid())
  title        String
  model        String
  status       String    @default("active")
  isPinned     Boolean   @default(false)
  isStarred    Boolean   @default(false)
  totalTokens  Int       @default(0)
  messageCount Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  messages     Message[]
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  role           String
  content        String
  model          String?
  tokenCount     Int?
  metadata       String       @default("{}")
  createdAt      DateTime     @default(now())
}

// ============ Knowledge Base (Phase 2) ============
model KnowledgeDocument {
  id        String   @id @default(uuid())
  title     String
  content   String
  summary   String?
  filePath  String?
  fileType  String
  fileSize  Int?
  isIndexed Boolean  @default(false)
  tags      String   @default("[]")
  folder    String?
  metadata  String   @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  cards     KnowledgeCard[]
}

model KnowledgeCard {
  id         String            @id @default(uuid())
  documentId String
  document   KnowledgeDocument @relation(fields: [documentId], references: [id])
  title      String
  content    String
  tags       String            @default("[]")
  isPinned   Boolean           @default(false)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt
}

// ============ Tasks (Phase 2) ============
model Task {
  id                   String       @id @default(uuid())
  title                String
  description          String?
  priority             String
  status               String
  dueDate              DateTime?
  completedAt          DateTime?
  isRecurring          Boolean      @default(false)
  recurRule            String?
  tags                 String       @default("[]")
  source               String       @default("manual")
  sourceConversationId String?
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt
  subtasks             Subtask[]
}

model Subtask {
  id          String   @id @default(uuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id])
  title       String
  isCompleted Boolean  @default(false)
  order       Int
  createdAt   DateTime @default(now())
}
```

### SQLite 实现要点

- **无 enum 类型**：所有 enum 字段在 SQLite 中用 `String` 存储，业务层校验值
- **无 vector 类型**：知识库语义搜索改为简单的全文关键词匹配（LIKE），向量检索留到后续迁移 PostgreSQL 时实现
- **无 jsonb 类型**：JSON 数据用 `String` 存储，读写时 JSON.parse/JSON.stringify
- **数据库文件**：`prisma/db/hourmind.db`，单文件存储，无需额外服务

---

## 6. 开发工作流

### 本地启动

```bash
# 1. 启动 Node.js 服务
cd server
npm install
npx prisma migrate dev        # 首次建表（生成 SQLite 文件）
npx prisma db seed             # 预置 7 家 AI 厂商
npm run dev                     # tsx watch src/index.ts（端口 3000）

# 2. 启动 Vue 前端
cd client
npm install
npm run dev                     # vite --port 5173
```

### package.json scripts

| 服务 | 命令 | 说明 |
|------|------|------|
| server | `npm run dev` | tsx watch，端口 3000 |
| server | `npm run build` | tsc 编译 |
| server | `npm run db:migrate` | prisma migrate dev |
| server | `npm run db:seed` | 预置厂商数据 |
| client | `npm run dev` | vite，端口 5173 |
| client | `npm run build` | vite build |

---

## 7. 种子数据 — AI 厂商预置

```typescript
// server/src/seed.ts — 7 家 AI 厂商

const providers = [
  { name: 'OpenAI',      slug: 'openai',   baseUrl: 'https://api.openai.com/v1' },
  { name: 'Anthropic',   slug: 'anthropic', baseUrl: 'https://api.anthropic.com' },
  { name: 'DeepSeek',    slug: 'deepseek',  baseUrl: 'https://api.deepseek.com/v1' },
  { name: 'Google Gemini', slug: 'gemini',  baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { name: 'xAI Grok',    slug: 'grok',      baseUrl: 'https://api.x.ai/v1' },
  { name: 'Moonshot',    slug: 'moonshot',  baseUrl: 'https://api.moonshot.cn/v1' },
  { name: '通义千问',    slug: 'qwen',      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
]
```

---

## 8. 前端 WebSocket 请求-响应封装

```typescript
// composables/useWs.ts — 全局单例，Promise 化

// 请求帧：{ id, type: 'request', action, payload }
// 响应帧：{ id, type: 'response', success, data/error }
// 推送帧：{ type: 'stream_chunk'/'stream_end'/'stream_error', ... }

// send(action, payload) → Promise<T>
// onPush(type, handler) / offPush(type, handler) — 流式推送监听

// 全局单例
export const wsClient = { connect, send, onPush, offPush }
```

---

## 9. 后续扩展路径

| 当前（SQLite MVP） | 后续（PostgreSQL 迁移后） |
|-------------------|--------------------------|
| 关键词搜索（LIKE） | 语义搜索（pgvector） |
| Node.js 直调厂商 API | 可选引入 Python 网关层 |
| 知识库全文存储 | 分块 + 向量化存储 |
| 全局记忆（规划中） | pgvector embedding |
| 单 SQLite 文件 | PostgreSQL + Docker Compose |
