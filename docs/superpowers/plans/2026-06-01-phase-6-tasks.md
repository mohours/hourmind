# HourMind 阶段 6 — 待办事项 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的待办事项管理模块，支持任务 CRUD、子任务、看板视图、筛选排序。

**Architecture:** Python FastAPI 后端 (port 8000) + Vue 3 + Vite 前端 (port 5173)，后端用 sqlite3 原生驱动，前端用 Pinia + Vue Router。JWT 认证已在阶段 2 实现，所有接口使用 `require_auth` 依赖。

**Tech Stack:** Python 3.12, FastAPI, uvicorn, sqlite3 / Vue 3, TypeScript, Vite 5, Pinia, Vue Router

---

### Task 1: 待办事项后端 API

**Files:**
- Create: `server/routes/tasks.py`
- Modify: `server/main.py`

- [ ] **Step 1: 创建 tasks.py**

```python
# server/routes/tasks.py
# 待办事项 API —— 任务 CRUD、子任务管理、筛选查询
from fastapi import APIRouter, Depends, Query, Body
from database import get_db
from routes.auth import require_auth
import json
import uuid

router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tasks")
def list_tasks(
    status: str = Query(""),
    priority: str = Query(""),
    user_id: str = Depends(require_auth),
):
    """查询任务列表 —— 支持按状态和优先级筛选，含子任务"""
    db = get_db()

    # 构建筛选条件
    conditions = []
    params = []

    if status:
        conditions.append("t.status = ?")
        params.append(status)

    if priority:
        conditions.append("t.priority = ?")
        params.append(priority)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    # 查询所有任务
    rows = db.execute(
        f"""SELECT t.* FROM task t
            {where_clause}
            ORDER BY
              CASE t.priority
                WHEN 'high' THEN 0
                WHEN 'medium' THEN 1
                WHEN 'low' THEN 2
                ELSE 3
              END,
              t.created_at DESC"""
    ).fetchall()

    # 收集所有 task_id，批量查询子任务
    task_ids = [row["id"] for row in rows]
    tasks = []
    subtasks_map = {}

    if task_ids:
        placeholders = ",".join("?" * len(task_ids))
        subtask_rows = db.execute(
            f"""SELECT * FROM subtask
                WHERE task_id IN ({placeholders})
                ORDER BY sort_order, created_at""",
            task_ids
        ).fetchall()

        # 按 task_id 分组子任务
        for st in subtask_rows:
            tid = st["task_id"]
            if tid not in subtasks_map:
                subtasks_map[tid] = []
            subtasks_map[tid].append({
                "id": st["id"],
                "task_id": st["task_id"],
                "title": st["title"],
                "is_completed": bool(st["is_completed"]),
                "sort_order": st["sort_order"],
                "created_at": st["created_at"],
            })

    # 组装返回数据
    for row in rows:
        tasks.append({
            "id": row["id"],
            "title": row["title"],
            "description": row["description"],
            "priority": row["priority"],
            "status": row["status"],
            "due_date": row["due_date"],
            "tags_json": row["tags_json"],
            "source": row["source"],
            "source_conversation_id": row["source_conversation_id"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "subtasks": subtasks_map.get(row["id"], []),
        })

    db.close()
    return {"tasks": tasks}


@router.post("/tasks")
def create_task(
    body: dict = Body(...),
    user_id: str = Depends(require_auth),
):
    """创建新任务"""
    db = get_db()
    task_id = str(uuid.uuid4())

    db.execute(
        """INSERT INTO task (id, title, description, priority, due_date, tags_json)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            task_id,
            body.get("title", ""),
            body.get("description", ""),
            body.get("priority", "medium"),
            body.get("due_date"),
            body.get("tags_json", "[]"),
        )
    )
    db.commit()
    db.close()

    return {"success": True, "id": task_id}


@router.put("/tasks/{task_id}")
def update_task(
    task_id: str,
    body: dict = Body(...),
    user_id: str = Depends(require_auth),
):
    """更新任务字段"""
    db = get_db()

    # 动态构建 SET 子句，只更新传入的字段
    allowed_fields = ["title", "description", "priority", "status", "due_date", "tags_json"]
    set_parts = []
    params = []

    for field in allowed_fields:
        if field in body:
            set_parts.append(f"{field} = ?")
            params.append(body[field])

    if not set_parts:
        db.close()
        return {"success": False, "error": "没有要更新的字段"}

    set_parts.append("updated_at = datetime('now')")
    params.append(task_id)

    db.execute(
        f"UPDATE task SET {', '.join(set_parts)} WHERE id = ?",
        params
    )
    db.commit()
    db.close()

    return {"success": True}


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: str,
    user_id: str = Depends(require_auth),
):
    """删除任务及其子任务（外键 CASCADE 自动处理子任务）"""
    db = get_db()
    db.execute("DELETE FROM task WHERE id = ?", (task_id,))
    db.commit()
    db.close()

    return {"success": True, "message": "任务已删除"}


@router.post("/tasks/{task_id}/subtasks")
def create_subtask(
    task_id: str,
    body: dict = Body(...),
    user_id: str = Depends(require_auth),
):
    """为任务创建子任务"""
    db = get_db()

    # 获取当前最大 sort_order
    max_order = db.execute(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM subtask WHERE task_id = ?",
        (task_id,)
    ).fetchone()["next_order"]

    subtask_id = str(uuid.uuid4())
    db.execute(
        """INSERT INTO subtask (id, task_id, title, sort_order)
           VALUES (?, ?, ?, ?)""",
        (subtask_id, task_id, body.get("title", ""), max_order)
    )
    db.commit()
    db.close()

    return {"success": True, "id": subtask_id}


@router.put("/subtasks/{subtask_id}/toggle")
def toggle_subtask(
    subtask_id: str,
    user_id: str = Depends(require_auth),
):
    """切换子任务完成状态"""
    db = get_db()

    # 先读取当前状态再反转
    row = db.execute(
        "SELECT is_completed FROM subtask WHERE id = ?",
        (subtask_id,)
    ).fetchone()

    if not row:
        db.close()
        return {"success": False, "error": "子任务不存在"}

    new_status = 0 if row["is_completed"] else 1
    db.execute(
        "UPDATE subtask SET is_completed = ? WHERE id = ?",
        (new_status, subtask_id)
    )
    db.commit()
    db.close()

    return {"success": True, "is_completed": bool(new_status)}


@router.delete("/subtasks/{subtask_id}")
def delete_subtask(
    subtask_id: str,
    user_id: str = Depends(require_auth),
):
    """删除子任务"""
    db = get_db()
    db.execute("DELETE FROM subtask WHERE id = ?", (subtask_id,))
    db.commit()
    db.close()

    return {"success": True, "message": "子任务已删除"}
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
from routes.tasks import router as tasks_router
app.include_router(tasks_router)
```

- [ ] **Step 3: 验证后端 API**

```bash
cd server
source venv/bin/activate
python main.py &
```

```bash
# 创建任务
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"title":"设计首页布局","priority":"high","due_date":"2026-06-15"}' \
  http://localhost:8000/api/tasks

# 查询任务列表
curl -H "Authorization: Bearer <token>" "http://localhost:8000/api/tasks?status=todo&priority=high"

# 创建子任务
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"title":"确认色彩方案"}' \
  http://localhost:8000/api/tasks/<task_id>/subtasks

# 切换子任务
curl -X PUT -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/subtasks/<subtask_id>/toggle
```

- [ ] **Step 4: 提交**

```bash
git add server/routes/tasks.py server/main.py
git commit -m "feat: 待办事项后端 API —— 任务 CRUD + 子任务管理 + 筛选查询"
```

---

### Task 2: 待办事项前端 Store

**Files:**
- Create: `client/src/stores/taskStore.ts`

- [ ] **Step 1: 创建 taskStore.ts**

```typescript
// client/src/stores/taskStore.ts
// 待办事项状态管理 —— 任务列表、子任务、视图切换、筛选
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 子任务接口
export interface Subtask {
  id: string
  task_id: string
  title: string
  is_completed: boolean
  sort_order: number
  created_at: string
}

// 任务接口
export interface Task {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  due_date: string | null
  tags_json: string
  source: string
  source_conversation_id: string | null
  created_at: string
  updated_at: string
  subtasks: Subtask[]
}

// API 请求基础函数
async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token') || ''
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`请求失败: ${url}`)
  return res.json()
}

export const useTaskStore = defineStore('tasks', () => {
  // --- 状态 ---
  const tasks = ref<Task[]>([])              // 任务列表
  const selectedTask = ref<Task | null>(null) // 当前选中的任务（右侧面板）
  const statusFilter = ref('')               // 状态筛选
  const priorityFilter = ref('')             // 优先级筛选
  const viewMode = ref<'list' | 'kanban'>('list') // 视图模式
  const loading = ref(false)                  // 加载状态

  // --- 计算属性 —— 用于看板视图的三列分组 ---
  const todoTasks = computed(() => tasks.value.filter(t => t.status === 'todo'))
  const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress'))
  const doneTasks = computed(() => tasks.value.filter(t => t.status === 'done'))

  // --- 操作 ---

  /** fetchTasks —— 从后端获取任务列表 */
  async function fetchTasks(): Promise<void> {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (statusFilter.value) params.set('status', statusFilter.value)
      if (priorityFilter.value) params.set('priority', priorityFilter.value)
      const data = await apiFetch(`/api/tasks?${params}`)
      tasks.value = data.tasks
    } finally {
      loading.value = false
    }
  }

  /** createTask —— 创建新任务 */
  async function createTask(task: Partial<Task>): Promise<string | null> {
    const data = await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        priority: task.priority || 'medium',
        due_date: task.due_date,
        tags_json: task.tags_json || '[]',
      }),
    })
    if (data.success) {
      await fetchTasks()
      return data.id
    }
    return null
  }

  /** updateTask —— 更新任务 */
  async function updateTask(id: string, updates: Partial<Task>): Promise<boolean> {
    const data = await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    if (data.success) {
      await fetchTasks()
    }
    return data.success
  }

  /** deleteTask —— 删除任务 */
  async function deleteTask(id: string): Promise<boolean> {
    const data = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (data.success) {
      tasks.value = tasks.value.filter(t => t.id !== id)
    }
    return data.success
  }

  /** addSubtask —— 添加子任务 */
  async function addSubtask(taskId: string, title: string): Promise<boolean> {
    const data = await apiFetch(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
    if (data.success) {
      await fetchTasks()
    }
    return data.success
  }

  /** toggleSubtask —— 切换子任务完成状态 */
  async function toggleSubtask(subtaskId: string): Promise<boolean> {
    const data = await apiFetch(`/api/subtasks/${subtaskId}/toggle`, {
      method: 'PUT',
    })
    if (data.success) {
      // 更新本地对应子任务的状态
      for (const task of tasks.value) {
        for (const st of task.subtasks) {
          if (st.id === subtaskId) {
            st.is_completed = data.is_completed
            return true
          }
        }
      }
    }
    return false
  }

  /** deleteSubtask —— 删除子任务 */
  async function deleteSubtask(subtaskId: string): Promise<boolean> {
    const data = await apiFetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' })
    if (data.success) {
      await fetchTasks()
    }
    return data.success
  }

  /** selectTask —— 选中任务显示右侧详情面板 */
  function selectTask(task: Task | null): void {
    selectedTask.value = task
  }

  return {
    tasks, selectedTask, statusFilter, priorityFilter, viewMode, loading,
    todoTasks, inProgressTasks, doneTasks,
    fetchTasks, createTask, updateTask, deleteTask,
    addSubtask, toggleSubtask, deleteSubtask,
    selectTask,
  }
})
```

- [ ] **Step 2: 提交**

```bash
git add client/src/stores/taskStore.ts
git commit -m "feat: 待办事项前端 Store —— 任务 CRUD + 子任务 + 看板分组"
```

---

### Task 3: 待办事项视图

**Files:**
- Create: `client/src/views/TasksView.vue`
- Create: `client/src/components/TaskCard.vue`
- Create: `client/src/components/TaskDialog.vue`
- Modify: `client/src/router.ts`

- [ ] **Step 1: 创建 TaskCard.vue 组件**

```vue
<!-- client/src/components/TaskCard.vue -->
<!-- 任务卡片组件 —— 显示任务简要信息 + 复选框 -->
<template>
  <div
    class="glass-card task-card"
    :class="{ 'task-done': task.status === 'done' }"
    @click="$emit('select', task)"
  >
    <!-- 完成复选框 -->
    <div class="task-check-area">
      <input
        type="checkbox"
        class="task-checkbox"
        :checked="task.status === 'done'"
        @change.stop="onToggleDone"
      />
    </div>

    <!-- 内容区域 -->
    <div class="task-content">
      <div class="task-header">
        <h3 class="task-title" :class="{ 'line-through': task.status === 'done' }">
          {{ task.title }}
        </h3>
        <span
          class="priority-badge"
          :class="`priority-${task.priority}`"
        >{{ priorityLabel(task.priority) }}</span>
      </div>

      <!-- 子任务进度 -->
      <div class="subtask-progress" v-if="task.subtasks.length > 0">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: subtaskProgress + '%' }"
          ></div>
        </div>
        <span class="progress-text">
          {{ completedSubtasks }}/{{ task.subtasks.length }}
        </span>
      </div>

      <div class="task-footer">
        <span class="task-due" v-if="task.due_date">
          📅 {{ formatDate(task.due_date) }}
        </span>
        <!-- 标签 -->
        <span class="task-tag" v-for="tag in taskTags" :key="tag">
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 任务卡片组件 Props
import { computed } from 'vue'
import type { Task } from '@/stores/taskStore'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  select: [task: Task]
  toggleDone: [taskId: string]
}>()

// 解析 tags_json
const taskTags = computed(() => {
  try { return JSON.parse(props.task.tags_json || '[]') }
  catch { return [] }
})

// 子任务完成进度
const completedSubtasks = computed(() =>
  props.task.subtasks.filter(s => s.is_completed).length
)
const subtaskProgress = computed(() => {
  if (props.task.subtasks.length === 0) return 0
  return Math.round((completedSubtasks.value / props.task.subtasks.length) * 100)
})

/** priorityLabel —— 优先级中文映射 */
function priorityLabel(p: string): string {
  const map: Record<string, string> = { high: '高', medium: '中', low: '低' }
  return map[p] || p
}

/** formatDate —— 日期格式化 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function onToggleDone(): void {
  emit('toggleDone', props.task.id)
}
</script>

<style scoped>
.task-card {
  display: flex; gap: 12px; padding: 16px; margin-bottom: 12px;
  transition: opacity 0.3s;
}
.task-done { opacity: 0.55; }
.task-check-area { padding-top: 2px; }
.task-checkbox { width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer; }
.task-content { flex: 1; }
.task-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.task-title { font-size: 16px; font-weight: 600; flex: 1; }
.line-through { text-decoration: line-through; color: var(--text-secondary); }

/* 优先级徽章 */
.priority-badge { font-size: 11px; padding: 2px 8px; border-radius: 8px; font-weight: 600; }
.priority-high { background: rgba(239, 68, 68, 0.2); color: #EF4444; }
.priority-medium { background: rgba(251, 146, 60, 0.2); color: #FB923C; }
.priority-low { background: rgba(148, 163, 184, 0.2); color: #94A3B8; }

/* 子任务进度条 */
.subtask-progress { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
.progress-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s; }
.progress-text { font-size: 12px; color: var(--text-secondary); min-width: 36px; }

.task-footer { display: flex; gap: 10px; align-items: center; margin-top: 6px; }
.task-due { font-size: 12px; color: var(--text-secondary); }
.task-tag { font-size: 11px; background: rgba(0, 229, 216, 0.1); color: var(--accent); padding: 2px 8px; border-radius: 6px; }
</style>
```

- [ ] **Step 2: 创建 TaskDialog.vue 组件**

```vue
<!-- client/src/components/TaskDialog.vue -->
<!-- 新建任务弹窗 —— 标题、描述、优先级、截止日期 -->
<template>
  <div class="dialog-overlay" v-if="visible" @click.self="$emit('close')">
    <div class="glass-card dialog-content">
      <h2 class="dialog-title">新建任务</h2>

      <div class="form-group">
        <label>任务标题</label>
        <input
          v-model="form.title"
          type="text"
          placeholder="输入任务标题..."
          class="glass-input"
          ref="titleInput"
        />
      </div>

      <div class="form-group">
        <label>描述</label>
        <textarea
          v-model="form.description"
          placeholder="任务描述（可选）"
          class="glass-textarea"
          rows="3"
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>优先级</label>
          <select v-model="form.priority" class="glass-select">
            <option value="low">低</option>
            <option value="medium" selected>中</option>
            <option value="high">高</option>
          </select>
        </div>
        <div class="form-group">
          <label>截止日期</label>
          <input v-model="form.due_date" type="date" class="glass-input" />
        </div>
      </div>

      <div class="dialog-actions">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button class="btn-primary" @click="onSubmit" :disabled="!form.title.trim()">
          创建任务
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 新建任务弹窗组件
import { ref, reactive, watch, nextTick } from 'vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  close: []
  submit: [task: { title: string; description: string; priority: string; due_date: string }]
}>()

const titleInput = ref<HTMLInputElement | null>(null)

const form = reactive({
  title: '',
  description: '',
  priority: 'medium',
  due_date: '',
})

// 弹窗打开时自动聚焦标题输入
watch(() => props.visible, async (v) => {
  if (v) {
    form.title = ''
    form.description = ''
    form.priority = 'medium'
    form.due_date = ''
    await nextTick()
    titleInput.value?.focus()
  }
})

function onSubmit(): void {
  if (!form.title.trim()) return
  emit('submit', { ...form })
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; backdrop-filter: blur(4px);
}
.dialog-content {
  width: 480px; max-width: 90vw; padding: 28px;
}
.dialog-title { font-size: 20px; margin-bottom: 20px; }
.form-group { margin-bottom: 16px; flex: 1; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.form-row { display: flex; gap: 16px; }
.glass-input, .glass-textarea, .glass-select {
  width: 100%; padding: 10px 14px;
  background: rgba(10,12,18,0.6); color: var(--text-primary);
  border: 1px solid var(--border-glow); border-radius: 10px;
  font-size: 14px; outline: none;
}
.glass-textarea { resize: vertical; font-family: inherit; }
.glass-select { cursor: pointer; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
.btn-cancel { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; padding: 10px 20px; font-size: 14px; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 3: 创建 TasksView.vue**

```vue
<!-- client/src/views/TasksView.vue -->
<!-- 待办事项页面 —— 列表/看板视图 + 任务详情面板 -->
<template>
  <div class="tasks-page">
    <!-- 顶部标题栏 -->
    <div class="tasks-header">
      <h1 class="page-title">个人待办事项</h1>
      <div class="header-actions">
        <!-- 视图切换 -->
        <div class="view-toggle">
          <button
            :class="{ active: store.viewMode === 'list' }"
            @click="store.viewMode = 'list'"
          >列表</button>
          <button
            :class="{ active: store.viewMode === 'kanban' }"
            @click="store.viewMode = 'kanban'"
          >看板</button>
        </div>
        <button class="btn-primary" @click="showDialog = true">+ 新建任务</button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar glass-card" v-if="store.viewMode === 'list'">
      <div class="filter-group">
        <label>状态</label>
        <select v-model="store.statusFilter" @change="store.fetchTasks()">
          <option value="">全部</option>
          <option value="todo">待办</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
        </select>
      </div>
      <div class="filter-group">
        <label>优先级</label>
        <select v-model="store.priorityFilter" @change="store.fetchTasks()">
          <option value="">全部</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="tasks-content" :class="{ 'has-detail': store.selectedTask }">
      <!-- 列表视图 -->
      <div class="task-list" v-if="store.viewMode === 'list'">
        <TaskCard
          v-for="task in store.tasks"
          :key="task.id"
          :task="task"
          @select="store.selectTask"
          @toggle-done="onToggleTaskDone"
        />
        <div class="empty-state" v-if="!store.loading && store.tasks.length === 0">
          <p>暂无待办事项，点击"+ 新建任务"开始</p>
        </div>
      </div>

      <!-- 看板视图 -->
      <div class="kanban-board" v-else>
        <div class="kanban-column">
          <div class="column-header todo-header">
            <span>待办</span>
            <span class="column-count">{{ store.todoTasks.length }}</span>
          </div>
          <div class="column-body">
            <TaskCard
              v-for="task in store.todoTasks"
              :key="task.id"
              :task="task"
              @select="store.selectTask"
              @toggle-done="onToggleTaskDone"
            />
          </div>
        </div>

        <div class="kanban-column">
          <div class="column-header progress-header">
            <span>进行中</span>
            <span class="column-count">{{ store.inProgressTasks.length }}</span>
          </div>
          <div class="column-body">
            <TaskCard
              v-for="task in store.inProgressTasks"
              :key="task.id"
              :task="task"
              @select="store.selectTask"
              @toggle-done="onToggleTaskDone"
            />
          </div>
        </div>

        <div class="kanban-column">
          <div class="column-header done-header">
            <span>已完成</span>
            <span class="column-count">{{ store.doneTasks.length }}</span>
          </div>
          <div class="column-body">
            <TaskCard
              v-for="task in store.doneTasks"
              :key="task.id"
              :task="task"
              @select="store.selectTask"
              @toggle-done="onToggleTaskDone"
            />
          </div>
        </div>
      </div>

      <!-- 右侧任务详情面板 -->
      <div class="detail-panel glass-card" v-if="store.selectedTask">
        <div class="detail-header">
          <h2>{{ store.selectedTask.title }}</h2>
          <button class="close-btn" @click="store.selectTask(null)">&times;</button>
        </div>

        <p class="detail-desc" v-if="store.selectedTask.description">
          {{ store.selectedTask.description }}
        </p>

        <!-- 子任务列表 -->
        <div class="subtask-section">
          <h3>子任务</h3>
          <div
            class="subtask-item"
            v-for="st in store.selectedTask.subtasks"
            :key="st.id"
          >
            <input
              type="checkbox"
              :checked="st.is_completed"
              @change="store.toggleSubtask(st.id)"
            />
            <span :class="{ 'line-through': st.is_completed }">{{ st.title }}</span>
            <button class="subtask-delete" @click="store.deleteSubtask(st.id)">
              ✕
            </button>
          </div>

          <!-- 添加子任务 -->
          <div class="add-subtask">
            <input
              v-model="newSubtaskTitle"
              type="text"
              placeholder="添加子任务..."
              @keyup.enter="onAddSubtask"
            />
            <button @click="onAddSubtask" :disabled="!newSubtaskTitle.trim()">+</button>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="detail-actions">
          <button class="btn-danger" @click="onDeleteTask">删除任务</button>
        </div>
      </div>
    </div>

    <!-- 新建任务弹窗 -->
    <TaskDialog
      :visible="showDialog"
      @close="showDialog = false"
      @submit="onCreateTask"
    />
  </div>
</template>

<script setup lang="ts">
// 待办事项视图组件 —— 列表/看板 + 任务详情
import { ref, onMounted } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import TaskCard from '@/components/TaskCard.vue'
import TaskDialog from '@/components/TaskDialog.vue'

const store = useTaskStore()
const showDialog = ref(false)
const newSubtaskTitle = ref('')

/** onCreateTask —— 处理新建任务弹窗提交 */
async function onCreateTask(task: {
  title: string; description: string; priority: string; due_date: string
}): Promise<void> {
  await store.createTask(task)
  showDialog.value = false
}

/** onDeleteTask —— 删除当前选中的任务 */
async function onDeleteTask(): Promise<void> {
  if (!store.selectedTask) return
  if (!confirm(`确认删除任务"${store.selectedTask.title}"？`)) return
  await store.deleteTask(store.selectedTask.id)
  store.selectTask(null)
}

/** onToggleTaskDone —— 切换任务完成状态 */
async function onToggleTaskDone(taskId: string): Promise<void> {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return
  const newStatus = task.status === 'done' ? 'todo' : 'done'
  await store.updateTask(taskId, { status: newStatus } as any)
}

/** onAddSubtask —— 添加子任务 */
async function onAddSubtask(): Promise<void> {
  if (!store.selectedTask || !newSubtaskTitle.value.trim()) return
  await store.addSubtask(store.selectedTask.id, newSubtaskTitle.value.trim())
  newSubtaskTitle.value = ''
}

onMounted(() => { store.fetchTasks() })
</script>

<style scoped>
.tasks-page { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }

/* 顶部标题栏 */
.tasks-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 24px; font-weight: 700; }
.header-actions { display: flex; gap: 12px; align-items: center; }

/* 视图切换 */
.view-toggle { display: flex; border-radius: 10px; overflow: hidden; border: 1px solid var(--border-glow); }
.view-toggle button {
  padding: 8px 16px; font-size: 13px; background: transparent; color: var(--text-secondary);
  border: none; cursor: pointer; transition: background 0.2s;
}
.view-toggle button.active { background: rgba(0, 229, 216, 0.15); color: var(--accent); }

/* 筛选栏 */
.filter-bar { display: flex; gap: 24px; padding: 14px 20px; margin-bottom: 20px; }
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-group label { font-size: 13px; color: var(--text-secondary); }
.filter-group select {
  background: rgba(10,12,18,0.8); color: var(--text-primary); border: 1px solid var(--border-glow);
  border-radius: 8px; padding: 6px 12px; font-size: 14px; outline: none;
}

/* 主内容区（列表 + 右侧面板） */
.tasks-content { display: flex; gap: 24px; }
.tasks-content.has-detail .task-list { flex: 1; }
.task-list { flex: 1; }
.empty-state { text-align: center; padding: 60px 0; color: var(--text-secondary); font-size: 15px; }

/* 看板视图 */
.kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; flex: 1; }
.kanban-column { display: flex; flex-direction: column; }
.column-header { display: flex; justify-content: space-between; padding: 12px 16px; border-radius: 12px 12px 0 0; font-weight: 600; font-size: 14px; }
.todo-header { background: rgba(148, 163, 184, 0.1); }
.progress-header { background: rgba(251, 146, 60, 0.1); }
.done-header { background: rgba(52, 211, 153, 0.1); }
.column-count { color: var(--text-secondary); font-weight: 400; }
.column-body { padding: 8px 0; }

/* 右侧详情面板 */
.detail-panel { width: 360px; padding: 24px; flex-shrink: 0; align-self: flex-start; position: sticky; top: 24px; }
.detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.detail-header h2 { font-size: 18px; }
.close-btn { background: transparent; border: none; color: var(--text-secondary); font-size: 22px; cursor: pointer; }
.detail-desc { color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 20px; }

/* 子任务区域 */
.subtask-section { margin-bottom: 20px; }
.subtask-section h3 { font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; }
.subtask-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.subtask-item input[type="checkbox"] { accent-color: var(--accent); }
.subtask-item span { font-size: 14px; flex: 1; }
.subtask-item .line-through { text-decoration: line-through; color: var(--text-secondary); }
.subtask-delete { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; opacity: 0; transition: opacity 0.2s; }
.subtask-item:hover .subtask-delete { opacity: 1; }

/* 添加子任务输入框 */
.add-subtask { display: flex; gap: 8px; margin-top: 10px; }
.add-subtask input {
  flex: 1; padding: 8px 12px; background: rgba(10,12,18,0.6); color: var(--text-primary);
  border: 1px solid var(--border-glow); border-radius: 8px; font-size: 13px; outline: none;
}
.add-subtask button {
  background: var(--accent); color: var(--bg-primary); border: none;
  border-radius: 8px; width: 32px; font-size: 18px; cursor: pointer; font-weight: 700;
}
.add-subtask button:disabled { opacity: 0.4; cursor: not-allowed; }

.detail-actions { margin-top: 20px; }
</style>
```

- [ ] **Step 4: 更新 router.ts**

```typescript
{ path: '/tasks', name: 'tasks', component: () => import('@/views/TasksView.vue') },
```

- [ ] **Step 5: 启动前端验证**

```bash
cd client
npm run dev
```

访问 `http://localhost:5173/#/tasks` 应看到待办事项页面，包含列表视图、新建任务弹窗、任务详情面板、看板切换。

- [ ] **Step 6: 提交**

```bash
git add client/src/components/TaskCard.vue client/src/components/TaskDialog.vue client/src/views/TasksView.vue client/src/router.ts
git commit -m "feat: 待办事项视图 —— 列表/看板 + 子任务进度 + 详情面板"
```

---

## 阶段 6 完成检查清单

- [ ] `GET /api/tasks` 按状态/优先级筛选，子任务内联返回
- [ ] `POST /api/tasks` 创建任务成功返回 ID
- [ ] `PUT /api/tasks/{id}` 更新任意字段
- [ ] `DELETE /api/tasks/{id}` 级联删除子任务
- [ ] `POST /api/tasks/{id}/subtasks` 创建子任务
- [ ] `PUT /api/subtasks/{id}/toggle` 切换完成状态
- [ ] 列表视图显示任务卡片（复选框、优先级徽章、子任务进度条、标签）
- [ ] 看板视图分三列（待办/进行中/已完成）
- [ ] 右侧详情面板展示子任务列表、支持添加/切换/删除子任务
- [ ] 新建任务弹窗含标题、描述、优先级、截止日期四个字段
