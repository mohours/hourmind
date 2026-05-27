# HourMind — 个人待办事项模块 技术设计规格

**日期**：2026-05-27
**版本**：v2.0（纯 SQLite 方案）
**范围**：Phase 2（基础 CRUD + AI 智能拆解 + 右侧详情）

> **状态**：本模块尚未实现，属于 Phase 2 开发范围。当前仅存储设计规格供后续参考。

---

## 1. 架构决策

| 决策点 | 选择 |
|--------|------|
| AI 任务拆解 | Node.js 调厂商 API（非流式），直接让模型生成子任务 JSON 列表 |
| 重复任务 | 存 cron 表达式，不自己实现调度器 |
| 对话创建任务 | 前端从对话中提取，调 `tasks.create` 关联 sourceConversationId |

---

## 2. 数据模型（SQLite）

### 2.1 `Task` — 任务

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| title | String | 任务标题 |
| description | String? | 详细描述 |
| priority | String | `high` / `medium` / `low` |
| status | String | `todo` / `in_progress` / `done` / `archived` |
| dueDate | DateTime? | 截止日期 |
| completedAt | DateTime? | 完成时间 |
| isRecurring | Boolean | 是否重复任务 |
| recurRule | String? | 重复规则（cron） |
| tags | String | JSON（标签数组） |
| source | String | `manual` / `chat_extracted` |
| sourceConversationId | String? | 关联对话 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 2.2 `Subtask` — 子任务

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| taskId | String | FK → Task |
| title | String | 子任务标题 |
| isCompleted | Boolean | 是否完成 |
| order | Int | 排序序号 |
| createdAt | DateTime | |

---

## 3. API 接口（规划）

### 任务 CRUD

| action | 说明 | payload |
|--------|------|---------|
| `tasks.list` | 任务列表 | `status?`, `priority?`, `sort?` |
| `tasks.create` | 创建任务 | `title`, `description?`, `priority?`, `dueDate?` |
| `tasks.update` | 编辑任务 | `taskId`, `title?`, `priority?`, `dueDate?` |
| `tasks.toggle` | 完成/取消 | `taskId` |
| `tasks.delete` | 删除 | `taskId` |
| `tasks.set_status` | 切换状态 | `taskId`, `status` |

### 子任务

| action | 说明 | payload |
|--------|------|---------|
| `subtasks.create` | 添加子任务 | `taskId`, `title` |
| `subtasks.toggle` | 勾选 | `subtaskId` |
| `subtasks.delete` | 删除 | `subtaskId` |

### AI 拆解

| action | 说明 | payload |
|--------|------|---------|
| `tasks.decompose` | AI 拆解为子任务 | `taskId` |

**拆解流程：**
```
1. Node.js 取任务 title + description
2. 调 AI 厂商 API（非流式），prompt：请将此任务拆解为 3-5 个子步骤，返回 JSON 数组
3. 解析 JSON → 逐条插入 subtasks
4. 返回前端
```

---

## 4. 前端路由与组件树（规划）

| 路由 | 页面 |
|------|------|
| `/tasks` | TasksView（三栏布局） |

```
views/
  └── TasksView.vue                  # 页面容器

components/tasks/
  ├── TasksToolbar.vue               # 顶部栏
  ├── TaskListView.vue               # 列表视图
  ├── TaskDetailPanel.vue            # 右侧详情面板
  └── TaskCreateDialog.vue           # 新建/编辑弹窗
```

---

## 5. 状态管理（taskStore 规划）

```typescript
interface TaskStoreState {
  tasks: Task[]
  loading: boolean
  search: string
  statusFilter: string
  selectedTaskId: string | null
  isDecomposing: boolean
}

// Actions
//   fetchTasks() / createTask(data) / updateTask(id, data)
//   toggleTask(id) / deleteTask(id)
//   decomposeTask(id) — AI 拆解
//   addSubtask(taskId, title) / toggleSubtask(id) / deleteSubtask(id)
```
