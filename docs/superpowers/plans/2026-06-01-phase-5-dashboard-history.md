# HourMind 阶段 5 — 仪表盘 + 对话历史 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现仪表盘首页（数据概览 + 快捷入口 + 最近对话）和对话历史管理（搜索、筛选、批量操作）。

**Architecture:** Python FastAPI 后端 (port 8000) + Vue 3 + Vite 前端 (port 5173)，后端用 sqlite3 原生驱动，前端用 Pinia + Vue Router。JWT 认证已在阶段 2 实现，所有接口使用 `require_auth` 依赖。

**Tech Stack:** Python 3.12, FastAPI, uvicorn, sqlite3 / Vue 3, TypeScript, Vite 5, Pinia, Vue Router

---

### Task 1: 仪表盘后端 API

**Files:**
- Create: `server/routes/dashboard.py`
- Modify: `server/main.py`

- [ ] **Step 1: 创建 routes 目录和 dashboard.py**

```bash
mkdir -p server/routes
touch server/routes/__init__.py
```

```python
# server/routes/dashboard.py
# 仪表盘 API —— 聚合今日用量、活跃模型、最近对话
from fastapi import APIRouter, Depends
from database import get_db
from routes.auth import require_auth  # 阶段 2 已实现
from datetime import datetime, date

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(user_id: str = Depends(require_auth)):
    """仪表盘聚合数据 —— 今日用量、活跃模型、最近对话"""
    db = get_db()

    today = date.today().isoformat()

    # 今日 token 用量（sum from conversation where updated_at 是今天）
    today_tokens = db.execute(
        """SELECT COALESCE(SUM(total_tokens), 0) as total
           FROM conversation
           WHERE date(updated_at) = ? AND status != 'deleted'""",
        (today,)
    ).fetchone()["total"]

    # 今日对话数
    today_convs = db.execute(
        """SELECT COUNT(*) as count
           FROM conversation
           WHERE date(created_at) = ? AND status != 'deleted'""",
        (today,)
    ).fetchone()["count"]

    # 活跃模型（今日使用过的 model，去重）
    active_models = db.execute(
        """SELECT DISTINCT model
           FROM conversation
           WHERE date(updated_at) = ?
             AND status != 'deleted'
             AND model IS NOT NULL
             AND model != ''""",
        (today,)
    ).fetchall()
    active_models_list = [row["model"] for row in active_models]

    # 最近 6 条对话
    recent = db.execute(
        """SELECT id, title, model, total_tokens, message_count, status,
                  created_at, updated_at, summary
           FROM conversation
           WHERE status != 'deleted'
           ORDER BY updated_at DESC
           LIMIT 6"""
    ).fetchall()

    recent_convs = []
    for row in recent:
        recent_convs.append({
            "id": row["id"],
            "title": row["title"],
            "model": row["model"],
            "total_tokens": row["total_tokens"],
            "message_count": row["message_count"],
            "status": row["status"],
            "summary": row["summary"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        })

    db.close()

    return {
        "today_tokens": today_tokens,
        "today_convs": today_convs,
        "active_models": active_models_list,
        "recent_convs": recent_convs,
    }
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
# server/main.py —— 在现有 import 后添加
from routes.dashboard import router as dashboard_router

# 在 app 定义之后添加
app.include_router(dashboard_router)
```

- [ ] **Step 3: 验证后端 API**

```bash
cd server
source venv/bin/activate
python main.py &
# 需要先获取 token，然后测试
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/dashboard
```

预期返回 JSON 包含 `today_tokens`, `today_convs`, `active_models`, `recent_convs` 四个字段。

- [ ] **Step 4: 提交**

```bash
git add server/routes/__init__.py server/routes/dashboard.py server/main.py
git commit -m "feat: 仪表盘后端 API —— 聚合今日用量 + 活跃模型 + 最近对话"
```

---

### Task 2: 对话历史后端 API

**Files:**
- Create: `server/routes/history.py`
- Modify: `server/main.py`

- [ ] **Step 1: 创建 history.py**

```python
# server/routes/history.py
# 对话历史 API —— 列表查询、搜索、筛选、批量删除/导出
from fastapi import APIRouter, Depends, Query, Body
from database import get_db
from routes.auth import require_auth
import json

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
def list_history(
    page: int = Query(1, ge=1),
    search: str = Query(""),
    status: str = Query(""),
    model: str = Query(""),
    user_id: str = Depends(require_auth),
):
    """分页查询对话列表 —— 支持搜索、筛选"""
    db = get_db()
    per_page = 20
    offset = (page - 1) * per_page

    # 构建动态 WHERE 条件
    conditions = ["status != 'deleted'"]
    params = []

    if search:
        conditions.append("title LIKE ?")
        params.append(f"%{search}%")

    if status:
        conditions.append("status = ?")
        params.append(status)

    if model:
        conditions.append("model = ?")
        params.append(model)

    where_clause = " AND ".join(conditions)

    # 查询总数
    count_row = db.execute(
        f"SELECT COUNT(*) as count FROM conversation WHERE {where_clause}",
        params
    ).fetchone()
    total = count_row["count"]
    total_pages = max(1, (total + per_page - 1) // per_page)

    # 查询分页数据
    rows = db.execute(
        f"""SELECT id, title, model, total_tokens, message_count, status,
                   summary, tags_json, is_pinned, is_starred,
                   created_at, updated_at
            FROM conversation
            WHERE {where_clause}
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?""",
        params + [per_page, offset]
    ).fetchall()

    conversations = []
    for row in rows:
        conversations.append({
            "id": row["id"],
            "title": row["title"],
            "model": row["model"],
            "total_tokens": row["total_tokens"],
            "message_count": row["message_count"],
            "status": row["status"],
            "summary": row["summary"],
            "tags_json": row["tags_json"],
            "is_pinned": row["is_pinned"],
            "is_starred": row["is_starred"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        })

    db.close()

    return {
        "conversations": conversations,
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
    }


@router.post("/history/batch")
def batch_operation(
    body: dict = Body(...),
    user_id: str = Depends(require_auth),
):
    """批量操作 —— delete（软删除）或 export（导出完整数据）"""
    ids = body.get("ids", [])
    action = body.get("action", "")

    if not ids or not action:
        return {"success": False, "error": "参数不能为空"}

    db = get_db()
    placeholders = ",".join("?" * len(ids))

    if action == "delete":
        # 软删除 —— 将 status 设为 deleted
        db.execute(
            f"UPDATE conversation SET status = 'deleted', updated_at = datetime('now') WHERE id IN ({placeholders})",
            ids
        )
        db.commit()
        db.close()
        return {"success": True, "message": f"已删除 {len(ids)} 条对话"}

    elif action == "export":
        # 导出 —— 返回完整对话数据（含消息 JSON）
        rows = db.execute(
            f"""SELECT id, title, model, messages_json, total_tokens,
                       message_count, tags_json, summary, created_at, updated_at
                FROM conversation
                WHERE id IN ({placeholders})""",
            ids
        ).fetchall()

        exports = []
        for row in rows:
            exports.append({
                "id": row["id"],
                "title": row["title"],
                "model": row["model"],
                "messages": json.loads(row["messages_json"] or "[]"),
                "total_tokens": row["total_tokens"],
                "message_count": row["message_count"],
                "tags": json.loads(row["tags_json"] or "[]"),
                "summary": row["summary"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            })

        db.close()
        return {"success": True, "data": exports}

    db.close()
    return {"success": False, "error": f"不支持的操作: {action}"}
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
from routes.history import router as history_router
app.include_router(history_router)
```

- [ ] **Step 3: 验证历史 API**

```bash
# 分页查询
curl -H "Authorization: Bearer <token>" "http://localhost:8000/api/history?page=1&search=测试&status=active"
# 批量删除
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"ids":["id1","id2"],"action":"delete"}' http://localhost:8000/api/history/batch
```

- [ ] **Step 4: 提交**

```bash
git add server/routes/history.py server/main.py
git commit -m "feat: 对话历史后端 API —— 分页查询 + 搜索筛选 + 批量删除/导出"
```

---

### Task 3: 仪表盘前端 Store

**Files:**
- Create: `client/src/stores/dashboardStore.ts`

- [ ] **Step 1: 创建 stores 目录和 dashboardStore.ts**

```bash
mkdir -p client/src/stores
```

```typescript
// client/src/stores/dashboardStore.ts
// 仪表盘状态管理 —— 管理仪表盘聚合数据和加载状态
import { defineStore } from 'pinia'
import { ref } from 'vue'

// 最近对话接口
export interface RecentConversation {
  id: string
  title: string
  model: string | null
  total_tokens: number
  message_count: number
  status: string
  summary: string | null
  created_at: string
  updated_at: string
}

// 仪表盘数据接口
export interface DashboardData {
  today_tokens: number
  today_convs: number
  active_models: string[]
  recent_convs: RecentConversation[]
}

export const useDashboardStore = defineStore('dashboard', () => {
  // --- 状态 ---
  const loading = ref(false)                    // 加载状态
  const todayTokens = ref(0)                    // 今日 token 用量
  const todayConvs = ref(0)                     // 今日对话数
  const activeModels = ref<string[]>([])         // 今日活跃模型列表
  const recentConvs = ref<RecentConversation[]>([]) // 最近 6 条对话

  // --- 操作 ---

  /** fetchSummary —— 从后端获取仪表盘聚合数据 */
  async function fetchSummary(): Promise<void> {
    loading.value = true
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('获取仪表盘数据失败')
      const data: DashboardData = await res.json()
      todayTokens.value = data.today_tokens
      todayConvs.value = data.today_convs
      activeModels.value = data.active_models
      recentConvs.value = data.recent_convs
    } finally {
      loading.value = false
    }
  }

  return { loading, todayTokens, todayConvs, activeModels, recentConvs, fetchSummary }
})
```

- [ ] **Step 2: 提交**

```bash
git add client/src/stores/dashboardStore.ts
git commit -m "feat: 仪表盘前端 Store —— fetchSummary 聚合数据管理"
```

---

### Task 4: 对话历史前端 Store

**Files:**
- Create: `client/src/stores/historyStore.ts`

- [ ] **Step 1: 创建 historyStore.ts**

```typescript
// client/src/stores/historyStore.ts
// 对话历史状态管理 —— 管理对话列表、搜索、筛选、批量操作
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 对话列表项接口
export interface ConversationItem {
  id: string
  title: string
  model: string | null
  total_tokens: number
  message_count: number
  status: string
  summary: string | null
  tags_json: string
  is_pinned: number
  is_starred: number
  created_at: string
  updated_at: string
}

export const useHistoryStore = defineStore('history', () => {
  // --- 状态 ---
  const conversations = ref<ConversationItem[]>([]) // 对话列表
  const search = ref('')                            // 搜索关键词
  const statusFilter = ref('')                      // 状态筛选
  const modelFilter = ref('')                       // 模型筛选
  const selectedIds = ref<string[]>([])             // 已选中的对话 ID
  const page = ref(1)                               // 当前页码
  const totalPages = ref(1)                         // 总页数
  const total = ref(0)                              // 总条目数
  const loading = ref(false)                        // 加载状态

  // --- 计算属性 ---
  const hasSelection = computed(() => selectedIds.value.length > 0)

  // --- 操作 ---

  /** fetchList —— 分页查询对话列表 */
  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      const params = new URLSearchParams({
        page: String(page.value),
        search: search.value,
        status: statusFilter.value,
        model: modelFilter.value,
      })
      const token = localStorage.getItem('token') || ''
      const res = await fetch(`/api/history?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('获取对话列表失败')
      const data = await res.json()
      conversations.value = data.conversations
      totalPages.value = data.total_pages
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  /** batchDelete —— 批量软删除选中对话 */
  async function batchDelete(ids: string[]): Promise<boolean> {
    const token = localStorage.getItem('token') || ''
    const res = await fetch('/api/history/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids, action: 'delete' }),
    })
    if (!res.ok) return false
    // 从本地列表移除已删除项
    const idSet = new Set(ids)
    conversations.value = conversations.value.filter((c) => !idSet.has(c.id))
    selectedIds.value = []
    return true
  }

  /** batchExport —— 批量导出对话数据 */
  async function batchExport(ids: string[]): Promise<any> {
    const token = localStorage.getItem('token') || ''
    const res = await fetch('/api/history/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids, action: 'export' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data
  }

  /** toggleSelect —— 切换对话选中状态 */
  function toggleSelect(id: string): void {
    const idx = selectedIds.value.indexOf(id)
    if (idx === -1) {
      selectedIds.value.push(id)
    } else {
      selectedIds.value.splice(idx, 1)
    }
  }

  /** toggleSelectAll —— 全选/取消全选 */
  function toggleSelectAll(): void {
    if (selectedIds.value.length === conversations.value.length) {
      selectedIds.value = []
    } else {
      selectedIds.value = conversations.value.map((c) => c.id)
    }
  }

  /** setPage —— 翻页并重新查询 */
  function setPage(p: number): void {
    page.value = p
    fetchList()
  }

  return {
    conversations, search, statusFilter, modelFilter,
    selectedIds, page, totalPages, total, loading,
    hasSelection,
    fetchList, batchDelete, batchExport,
    toggleSelect, toggleSelectAll, setPage,
  }
})
```

- [ ] **Step 2: 提交**

```bash
git add client/src/stores/historyStore.ts
git commit -m "feat: 对话历史前端 Store —— 分页查询 + 搜索筛选 + 批量操作"
```

---

### Task 5: 仪表盘视图

**Files:**
- Create: `client/src/views/DashboardView.vue`
- Modify: `client/src/router.ts`

- [ ] **Step 1: 创建 DashboardView.vue**

```vue
<!-- client/src/views/DashboardView.vue -->
<!-- 仪表盘首页 —— 数据概览 + 快捷入口 + 最近对话 -->
<template>
  <div class="dashboard">
    <!-- 欢迎区域 -->
    <div class="welcome-section">
      <h1 class="welcome-greeting">{{ greeting }}，欢迎回来</h1>
      <p class="welcome-date">{{ currentDate }}</p>
    </div>

    <!-- 统计卡片网格 -->
    <div class="stats-grid" v-if="!store.loading">
      <div class="glass-card stat-card">
        <div class="stat-icon token-icon">⚡</div>
        <div class="stat-info">
          <span class="stat-value">{{ formatNumber(store.todayTokens) }}</span>
          <span class="stat-label">今日 Token 用量</span>
        </div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-icon conv-icon">💬</div>
        <div class="stat-info">
          <span class="stat-value">{{ store.todayConvs }}</span>
          <span class="stat-label">今日对话</span>
        </div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-icon model-icon">🤖</div>
        <div class="stat-info">
          <span class="stat-value">{{ store.activeModels.length }}</span>
          <span class="stat-label">活跃模型</span>
        </div>
        <!-- 模型环图（CSS 实现） -->
        <div class="model-ring" v-if="store.activeModels.length > 0">
          <div
            v-for="(model, idx) in store.activeModels"
            :key="model"
            class="ring-segment"
            :style="ringSegmentStyle(idx, store.activeModels.length)"
            :title="model"
          ></div>
        </div>
      </div>
    </div>

    <!-- 快捷入口按钮 -->
    <div class="quick-actions glass-card">
      <button class="quick-btn" @click="$router.push('/chat')">
        <span class="quick-icon">✨</span>
        <span>新对话</span>
      </button>
      <button class="quick-btn" @click="$router.push('/keys')">
        <span class="quick-icon">🔑</span>
        <span>Key 管理</span>
      </button>
      <button class="quick-btn" @click="$router.push('/knowledge')">
        <span class="quick-icon">📚</span>
        <span>知识库</span>
      </button>
      <button class="quick-btn" @click="$router.push('/tasks')">
        <span class="quick-icon">✓</span>
        <span>待办事项</span>
      </button>
    </div>

    <!-- 最近对话 -->
    <div class="recent-section" v-if="store.recentConvs.length > 0">
      <h2 class="section-title">最近对话</h2>
      <div class="recent-scroll">
        <div
          v-for="conv in store.recentConvs"
          :key="conv.id"
          class="glass-card recent-card"
          @click="$router.push(`/chat?id=${conv.id}`)"
        >
          <h3 class="recent-title">{{ conv.title }}</h3>
          <p class="recent-summary" v-if="conv.summary">{{ conv.summary }}</p>
          <div class="recent-meta">
            <span class="recent-model" v-if="conv.model">{{ conv.model }}</span>
            <span class="recent-tokens">{{ conv.total_tokens }} tokens</span>
            <span class="recent-time">{{ formatTime(conv.updated_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 仪表盘视图组件 —— 聚合数据、快捷入口、最近对话
import { ref, computed, onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboardStore'

const store = useDashboardStore()

// 当前日期（中文格式）
const currentDate = computed(() => {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  }
  return now.toLocaleDateString('zh-CN', options)
})

// 根据时间返回问候语
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

/** formatNumber —— 格式化大数字（超过 1000 用 K 表示） */
function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

/** formatTime —— 格式化时间戳为相对时间 */
function formatTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

/** ringSegmentStyle —— 计算环图扇区样式（纯 CSS conic-gradient） */
function ringSegmentStyle(idx: number, total: number) {
  const colors = ['#00E5D8', '#C4B5FD', '#FB923C', '#34D399', '#F472B6', '#60A5FA']
  const deg = 360 / total
  return {
    background: `conic-gradient(${colors[idx % colors.length]} ${idx * deg}deg, transparent ${(idx + 1) * deg}deg)`,
  }
}

onMounted(() => { store.fetchSummary() })
</script>

<style scoped>
.dashboard {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* 欢迎区域 */
.welcome-greeting {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent-purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.welcome-date { color: var(--text-secondary); margin-top: 8px; font-size: 15px; }

/* 统计卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 28px;
}
.stat-card {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon { font-size: 32px; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--accent); display: block; }
.stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; display: block; }

/* 模型环图 */
.model-ring {
  width: 48px; height: 48px;
  border-radius: 50%;
  margin-left: auto;
  overflow: hidden;
  position: relative;
}

/* 快捷入口 */
.quick-actions {
  display: flex;
  gap: 16px;
  margin-top: 28px;
  padding: 20px 24px;
  justify-content: center;
}
.quick-btn {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  background: transparent; border: none; color: var(--text-primary);
  cursor: pointer; padding: 12px 20px; border-radius: 12px;
  transition: background 0.2s;
}
.quick-btn:hover { background: rgba(0, 229, 216, 0.08); }
.quick-icon { font-size: 24px; }

/* 最近对话滚动区域 */
.recent-section { margin-top: 32px; }
.section-title { font-size: 20px; margin-bottom: 16px; }
.recent-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-width: thin;
}
.recent-card {
  min-width: 260px;
  max-width: 300px;
  padding: 20px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.recent-card:hover { transform: translateY(-4px); }
.recent-title {
  font-size: 16px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.recent-summary {
  font-size: 13px; color: var(--text-secondary);
  margin-top: 8px; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.recent-meta {
  display: flex; gap: 12px; margin-top: 12px;
  font-size: 12px; color: var(--text-secondary);
}
</style>
```

- [ ] **Step 2: 更新 router.ts 指向新组件**

```typescript
// client/src/router.ts —— 修改 dashboard 路由
{ path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
```

- [ ] **Step 3: 启动前端验证**

```bash
cd client
npm run dev
```

访问 `http://localhost:5173` 应看到仪表盘页面，包含欢迎语、统计卡片、快捷入口、最近对话区域。

- [ ] **Step 4: 提交**

```bash
git add client/src/views/DashboardView.vue client/src/router.ts
git commit -m "feat: 仪表盘视图 —— 数据概览 + 快捷入口 + 最近对话横向滚动"
```

---

### Task 6: 对话历史视图

**Files:**
- Create: `client/src/views/HistoryView.vue`
- Modify: `client/src/router.ts`

- [ ] **Step 1: 创建 HistoryView.vue**

```vue
<!-- client/src/views/HistoryView.vue -->
<!-- 对话历史页面 —— 搜索筛选 + 列表 + 批量操作 -->
<template>
  <div class="history-page">
    <!-- 顶部标题栏 -->
    <div class="history-header">
      <h1 class="page-title">对话历史</h1>
      <div class="header-actions">
        <input
          v-model="store.search"
          type="text"
          placeholder="搜索对话标题..."
          class="glass-input search-input"
          @input="onSearch"
        />
      </div>
    </div>

    <!-- 筛选面板 -->
    <div class="filter-bar glass-card">
      <div class="filter-group">
        <label>状态</label>
        <select v-model="store.statusFilter" @change="store.fetchList()">
          <option value="">全部</option>
          <option value="active">活跃</option>
          <option value="archived">已归档</option>
        </select>
      </div>
      <div class="filter-group">
        <label>模型</label>
        <select v-model="store.modelFilter" @change="store.fetchList()">
          <option value="">全部模型</option>
          <option value="gpt-4">GPT-4</option>
          <option value="gpt-3.5-turbo">GPT-3.5</option>
          <option value="claude-3-opus">Claude 3 Opus</option>
          <option value="deepseek-chat">DeepSeek</option>
        </select>
      </div>
    </div>

    <!-- 批量操作栏（选中项可见） -->
    <div class="batch-bar glass-card" v-if="store.hasSelection">
      <span class="batch-count">已选择 {{ store.selectedIds.length }} 项</span>
      <button class="btn-primary" @click="onBatchExport">导出选中</button>
      <button class="btn-danger" @click="onBatchDelete">删除选中</button>
      <button class="btn-cancel" @click="store.selectedIds = []">取消</button>
    </div>

    <!-- 对话列表 -->
    <div class="history-list" v-if="!store.loading">
      <div
        v-for="conv in store.conversations"
        :key="conv.id"
        class="glass-card history-item"
      >
        <!-- 选择框 -->
        <input
          type="checkbox"
          class="item-checkbox"
          :checked="store.selectedIds.includes(conv.id)"
          @change="store.toggleSelect(conv.id)"
        />

        <!-- 对话信息 -->
        <div class="item-body" @click="$router.push(`/chat?id=${conv.id}`)">
          <div class="item-header">
            <h3 class="item-title">{{ conv.title }}</h3>
            <span class="item-pin" v-if="conv.is_pinned">📌</span>
            <span class="item-star" v-if="conv.is_starred">⭐</span>
          </div>
          <p class="item-summary" v-if="conv.summary">{{ conv.summary }}</p>
          <div class="item-meta">
            <span class="item-model" v-if="conv.model">{{ conv.model }}</span>
            <span class="item-tokens">{{ conv.total_tokens }} tokens</span>
            <span class="item-count">{{ conv.message_count }} 条消息</span>
            <span class="item-time">{{ formatTime(conv.updated_at) }}</span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div class="empty-state" v-if="store.conversations.length === 0">
        <p>暂无对话记录</p>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="store.totalPages > 1">
      <button
        :disabled="store.page <= 1"
        @click="store.setPage(store.page - 1)"
      >上一页</button>
      <span class="page-info">{{ store.page }} / {{ store.totalPages }}</span>
      <button
        :disabled="store.page >= store.totalPages"
        @click="store.setPage(store.page + 1)"
      >下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 对话历史视图组件 —— 搜索筛选、批量操作、分页列表
import { onMounted } from 'vue'
import { useHistoryStore } from '@/stores/historyStore'

const store = useHistoryStore()

let searchTimer: ReturnType<typeof setTimeout> | null = null

/** onSearch —— 搜索输入防抖（300ms） */
function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    store.page = 1
    store.fetchList()
  }, 300)
}

/** onBatchDelete —— 批量删除确认 */
async function onBatchDelete(): Promise<void> {
  if (!confirm(`确认删除选中的 ${store.selectedIds.length} 条对话？此操作可恢复。`)) return
  const ok = await store.batchDelete(store.selectedIds)
  if (ok) alert('删除成功')
}

/** onBatchExport —— 批量导出为 JSON 文件 */
async function onBatchExport(): Promise<void> {
  const data = await store.batchExport(store.selectedIds)
  if (!data) return
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hourmind-export-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** formatTime —— 格式化时间戳为相对时间 */
function formatTime(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

onMounted(() => { store.fetchList() })
</script>

<style scoped>
.history-page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }

/* 顶部标题栏 */
.history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 24px; font-weight: 700; }
.search-input { width: 280px; padding: 10px 16px; color: var(--text-primary); background: var(--glass-bg); border: 1px solid var(--border-glow); border-radius: 12px; outline: none; font-size: 14px; }
.search-input::placeholder { color: var(--text-secondary); }

/* 筛选栏 */
.filter-bar { display: flex; gap: 24px; padding: 16px 20px; margin-bottom: 20px; }
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-group label { font-size: 13px; color: var(--text-secondary); }
.filter-group select {
  background: rgba(10,12,18,0.8); color: var(--text-primary); border: 1px solid var(--border-glow);
  border-radius: 8px; padding: 6px 12px; font-size: 14px; outline: none;
}

/* 批量操作栏 */
.batch-bar { display: flex; align-items: center; gap: 12px; padding: 12px 20px; margin-bottom: 20px; }
.batch-count { color: var(--accent); font-weight: 600; flex: 1; }
.btn-cancel { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; padding: 8px 16px; }

/* 对话列表 */
.history-list { display: flex; flex-direction: column; gap: 12px; }
.history-item { display: flex; align-items: flex-start; padding: 16px; gap: 12px; }
.item-checkbox { margin-top: 4px; accent-color: var(--accent); width: 18px; height: 18px; }
.item-body { flex: 1; cursor: pointer; }
.item-header { display: flex; align-items: center; gap: 8px; }
.item-title { font-size: 16px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-summary { font-size: 13px; color: var(--text-secondary); margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.item-meta { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
.empty-state { text-align: center; padding: 60px 0; color: var(--text-secondary); }

/* 分页 */
.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; }
.pagination button { background: var(--glass-bg); color: var(--text-primary); border: 1px solid var(--border-glow); border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 14px; }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 14px; color: var(--text-secondary); }
</style>
```

- [ ] **Step 2: 更新 router.ts**

```typescript
{ path: '/history', name: 'history', component: () => import('@/views/HistoryView.vue') },
```

- [ ] **Step 3: 验证前端页面**

```bash
cd client
npm run dev
```

访问 `http://localhost:5173/#/history` 应看到对话历史页面，包含搜索框、筛选栏、对话列表、分页控件。

- [ ] **Step 4: 提交**

```bash
git add client/src/views/HistoryView.vue client/src/router.ts
git commit -m "feat: 对话历史视图 —— 搜索筛选 + 批量操作 + 分页列表"
```

---

## 阶段 5 完成检查清单

- [ ] `GET /api/dashboard` 返回今日用量、今日对话数、活跃模型、最近 6 条对话
- [ ] `GET /api/history?page=1&search=&status=&model=` 分页查询对话，支持搜索和筛选
- [ ] `POST /api/history/batch` 支持软删除和导出 JSON
- [ ] 仪表盘页面显示欢迎语（早/中/晚）、统计卡片、快捷入口、最近对话横向滚动
- [ ] 对话历史页面显示搜索栏、筛选面板、玻璃卡片列表、批量操作栏、分页
- [ ] 批量导出生成 JSON 文件下载
- [ ] 批量删除弹出确认框，执行后列表自动更新
