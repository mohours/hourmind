# HourMind 阶段 1 — 项目骨架搭建 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建前后端项目骨架，后端能启动、数据库能初始化、前端能看到页面。

**Architecture:** Python FastAPI 后端 (port 8000) + Vue 3 + Vite 前端 (port 5173)，后端用 sqlite3 原生驱动，前端用 Pinia + Vue Router。

**Tech Stack:** Python 3.12, FastAPI, uvicorn, sqlite3 / Vue 3, TypeScript, Vite 5, Pinia, Vue Router

---

### Task 1: 后端项目初始化

**Files:**
- Create: `server/requirements.txt`
- Create: `server/.env`
- Create: `server/config.py`

- [ ] **Step 1: 创建目录和 requirements.txt**

```bash
mkdir -p server
```

```txt
# server/requirements.txt
fastapi
uvicorn[standard]
websockets
python-jose[cryptography]
bcrypt
cryptography
httpx
python-dotenv
```

```bash
cd server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 2: 创建 .env**

```txt
# server/.env
JWT_SECRET=hourmind-dev-secret-change-in-production
ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456
DATABASE_PATH=data/hourmind.db
PORT=8000
```

- [ ] **Step 3: 创建 config.py**

```python
# server/config.py
# 从 .env 加载配置，供其他模块引用
import os
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "dev-key-32-chars!!!")
DATABASE_PATH = os.getenv("DATABASE_PATH", "data/hourmind.db")
PORT = int(os.getenv("PORT", "8000"))
```

- [ ] **Step 4: 提交**

```bash
git add server/requirements.txt server/.env server/config.py
git commit -m "chore: 初始化后端项目配置文件"
```

---

### Task 2: 数据库初始化

**Files:**
- Create: `server/db/schema.sql`
- Create: `server/db/seed.sql`
- Create: `server/database.py`

- [ ] **Step 1: 创建目录和建表 SQL**

```bash
mkdir -p server/db/migrations server/data
```

```sql
-- server/db/schema.sql
-- HourMind 数据库建表脚本

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

```sql
-- server/db/seed.sql
-- 预置 7 家 AI 厂商（用 INSERT OR IGNORE 保证幂等）

INSERT OR IGNORE INTO provider (id, name, slug, base_url, is_active) VALUES
  ('p1', 'OpenAI',       'openai',     'https://api.openai.com/v1',                              1),
  ('p2', 'Anthropic',    'anthropic',  'https://api.anthropic.com',                              1),
  ('p3', 'DeepSeek',     'deepseek',   'https://api.deepseek.com/v1',                            1),
  ('p4', 'Google Gemini','gemini',     'https://generativelanguage.googleapis.com/v1beta',        1),
  ('p5', 'xAI Grok',     'grok',       'https://api.x.ai/v1',                                    1),
  ('p6', 'Moonshot',     'moonshot',   'https://api.moonshot.cn/v1',                             1),
  ('p7', '通义千问',     'qwen',       'https://dashscope.aliyuncs.com/compatible-mode/v1',      1);
```

- [ ] **Step 2: 执行建表和种子数据，验证**

```bash
cd server
sqlite3 data/hourmind.db < db/schema.sql
sqlite3 data/hourmind.db < db/seed.sql
sqlite3 data/hourmind.db "SELECT * FROM provider;"
```

预期输出：7 行厂商数据。

- [ ] **Step 3: 创建 database.py**

```python
# server/database.py
# sqlite3 连接管理 —— 提供 get_db() 获取数据库连接
import sqlite3
from config import DATABASE_PATH

def get_db() -> sqlite3.Connection:
    """获取数据库连接，每次调用返回新连接"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # 让查询结果可以用 row['name'] 访问
    conn.execute("PRAGMA journal_mode=WAL")  # 写操作不阻塞读
    conn.execute("PRAGMA foreign_keys=ON")   # 启用外键约束
    return conn

def init_db():
    """初始化数据库 —— 执行 schema.sql 和 seed.sql"""
    import os
    conn = sqlite3.connect(DATABASE_PATH)
    base = os.path.dirname(os.path.abspath(__file__))

    with open(os.path.join(base, "db", "schema.sql")) as f:
        conn.executescript(f.read())

    with open(os.path.join(base, "db", "seed.sql")) as f:
        conn.executescript(f.read())

    conn.commit()
    conn.close()
```

- [ ] **Step 4: 提交**

```bash
git add server/db/ server/database.py
git commit -m "chore: 初始化数据库 —— 7 张表 + 7 家厂商种子数据"
```

---

### Task 3: 后端入口 — FastAPI 启动

**Files:**
- Create: `server/main.py`

- [ ] **Step 1: 创建 main.py**

```python
# server/main.py
# FastAPI 应用入口 —— 启动 HTTP 服务和 WebSocket 端点
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import PORT
from database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动时初始化数据库"""
    init_db()
    yield


app = FastAPI(title="HourMind API", version="1.0.0", lifespan=lifespan)

# CORS —— 允许前端开发服务器跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    """健康检查接口"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
```

- [ ] **Step 2: 启动后端，验证**

```bash
cd server
source venv/bin/activate
python main.py
```

浏览器打开 `http://localhost:8000/api/health`，预期显示：`{"status":"ok"}`

- [ ] **Step 3: 提交**

```bash
git add server/main.py
git commit -m "feat: FastAPI 入口 —— /api/health + DB 自动初始化"
```

---

### Task 4: 前端项目初始化

**Files:**
- Create: `client/` (通过 Vite 脚手架)

- [ ] **Step 1: 用 Vite 创建 Vue 3 + TypeScript 项目**

```bash
cd /Users/hours/hourmind
npm create vite@latest client -- --template vue-ts
cd client
npm install
```

- [ ] **Step 2: 安装额外依赖**

```bash
cd client
npm install vue-router@4 pinia marked highlight.js
npm install -D @types/node
```

- [ ] **Step 3: 配置 Vite 代理和端口**

在 `client/vite.config.ts` 中：

```typescript
// client/vite.config.ts
// Vite 配置 —— 端口 5173，API 代理到后端 8000
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
```

- [ ] **Step 4: 清理脚手架生成的无用文件**

```bash
rm client/src/components/HelloWorld.vue
rm client/src/assets/vue.svg
rm client/public/vite.svg
```

- [ ] **Step 5: 验证前端能启动**

```bash
cd client
npm run dev
```

浏览器打开 `http://localhost:5173`，预期看到 Vue 默认页面。

- [ ] **Step 6: 提交**

```bash
git add client/
git commit -m "chore: 初始化 Vue 3 + Vite 前端项目"
```

---

### Task 5: 前端路由框架 + Quantum Glass 全局样式

**Files:**
- Create: `client/src/router.ts`
- Create: `client/src/style.css`
- Modify: `client/src/main.ts`
- Modify: `client/src/App.vue`
- Modify: `client/index.html`

- [ ] **Step 1: 创建 router.ts**

```typescript
// client/src/router.ts
// 前端路由配置 —— Hash 模式，9 个页面
import { createRouter, createWebHashHistory } from 'vue-router'

// 先创建占位组件，后续逐步替换
const Placeholder = { template: '<div class="placeholder-page">页面建设中</div>' }

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/setup',     name: 'setup',     component: () => import('@/views/SetupView.vue') },
    { path: '/login',     name: 'login',     component: () => import('@/views/LoginView.vue') },
    { path: '/',          name: 'dashboard', component: Placeholder },
    { path: '/chat',      name: 'chat',      component: Placeholder },
    { path: '/keys',      name: 'keys',      component: Placeholder },
    { path: '/history',   name: 'history',   component: Placeholder },
    { path: '/tasks',     name: 'tasks',     component: Placeholder },
    { path: '/knowledge', name: 'knowledge', component: Placeholder },
    { path: '/settings',  name: 'settings',  component: Placeholder },
  ],
})
```

- [ ] **Step 2: 创建占位的 Setup 和 Login 视图**

```bash
mkdir -p client/src/views
```

```vue
<!-- client/src/views/SetupView.vue -->
<template>
  <div class="auth-container">
    <h1>HourMind</h1>
    <p>设置密码 —— 开发中</p>
  </div>
</template>
```

```vue
<!-- client/src/views/LoginView.vue -->
<template>
  <div class="auth-container">
    <h1>HourMind</h1>
    <p>登录 —— 开发中</p>
  </div>
</template>
```

- [ ] **Step 3: 创建 Quantum Glass 全局样式**

```css
/* client/src/style.css */
/* Quantum Glass 量子玻璃 —— 全局主题样式 */

:root {
  --bg-primary: #0A0C12;
  --glass-bg: rgba(16, 18, 27, 0.72);
  --accent: #00E5D8;
  --accent-purple: #C4B5FD;
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --border-glow: rgba(0, 229, 216, 0.18);
  --success: #34D399;
  --warning: #FB923C;
  --radius: 16px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

/* 玻璃卡片 */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glow);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3),
              0 0 0 1px rgba(0, 229, 216, 0.1) inset;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.glass-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4),
              0 0 0 1px rgba(0, 229, 216, 0.2) inset;
}

/* 量子青按钮 */
.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  border-radius: var(--radius);
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: box-shadow 0.25s ease, transform 0.15s ease;
}

.btn-primary:hover {
  box-shadow: 0 0 24px rgba(0, 229, 216, 0.5);
  transform: scale(1.02);
}

.btn-primary:active {
  transform: scale(0.98);
}

/* 危险按钮 */
.btn-danger {
  background: transparent;
  color: #EF4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: var(--radius);
  padding: 12px 24px;
  font-size: 16px;
  cursor: pointer;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #EF4444;
}

/* 认证页面容器 */
.auth-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.auth-container h1 {
  font-size: 48px;
  background: linear-gradient(135deg, var(--accent), var(--accent-purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 2px;
}
```

- [ ] **Step 4: 修改 index.html**

```html
<!-- client/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HourMind - 小时智脑</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: 修改 main.ts 挂载路由和 Pinia**

```typescript
// client/src/main.ts
// Vue 应用入口 —— 挂载 Pinia、Router、全局样式
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 6: 修改 App.vue 用 router-view**

```vue
<!-- client/src/App.vue -->
<template>
  <router-view />
</template>
```

- [ ] **Step 7: 验证前端页面**

```bash
cd client
npm run dev
```

访问 `http://localhost:5173/#/login` 应看到 HourMind 标题和"登录 —— 开发中"。  
访问 `http://localhost:5173/#/setup` 应看到设置密码页面。

- [ ] **Step 8: 提交**

```bash
git add client/src/ client/index.html
git commit -m "feat: 前端路由框架 + Quantum Glass 全局样式"
```

---

## 阶段 1 完成检查清单

- [ ] `python main.py` 启动后端，`/api/health` 返回 `{"status":"ok"}`
- [ ] `npm run dev` 启动前端，页面可访问
- [ ] 浏览器访问 `http://localhost:5173` 能看到内容
- [ ] 数据库 7 张表已创建，7 家厂商数据已写入
