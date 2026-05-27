# HourMind — 历史记录模块 技术设计规格

**日期**：2026-05-27
**版本**：v2.0（纯 SQLite 方案）
**范围**：Phase 1（列表展示 + 搜索筛选 + 批量操作）+ Phase 2（标签系统 + AI 会话总结 + 预览面板）

> **状态**：本模块尚未实现，属于下一阶段开发范围。

---

## 1. 架构决策

| 决策点 | 选择 |
|--------|------|
| AI 会话总结 | Node.js 调厂商 API（非流式），prompt 生成 200 字摘要 |
| 数据存储 | 复用 `Conversation` + `Message` 表，新增 `Conversation.summary` 字段 |
| 导出格式 | Markdown / JSON |

---

## 2. 数据模型

本模块不新建任何表。依赖已有的：

| 内容 | 来源 |
|------|------|
| 会话列表/搜索 | `Conversation` |
| 会话内容预览 | `Message`（取最新一条 user 消息前 2-3 行） |
| 对话轮数/Token | `Conversation` 已有字段 |
| AI 总结 | 取全部 `Message` → 调厂商 API → 写入 `Conversation.summary` |

### `Conversation` 表补充字段

| 字段 | 类型 | 说明 |
|------|------|------|
| summary | String? | AI 生成的会话摘要（200 字以内）— Phase 2 |

---

## 3. API 接口（规划）

| action | 说明 | payload |
|--------|------|---------|
| `history.list` | 历史记录列表 | `search?`, `status?`, `model?`, `dateFrom?`, `dateTo?`, `page?`, `sort?` |
| `history.batch_delete` | 批量删除 | `conversationIds[]` |
| `history.batch_archive` | 批量归档 | `conversationIds[]` |
| `history.recover` | 恢复已删除 | `conversationId` |
| `history.summarize` | AI 生成会话总结 | `conversationId` — Phase 2 |

---

## 4. 前端路由与组件树（规划）

### 路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/history` | HistoryView | 历史记录三栏布局 |

### 组件树

```
views/
  └── HistoryView.vue                    # 页面容器

components/history/
  ├── HistoryToolbar.vue                 # 顶部栏（搜索 + 筛选）
  ├── HistoryFilterPanel.vue             # 左侧筛选面板
  ├── HistoryList.vue                    # 中间列表区
  └── HistoryDetailPanel.vue             # 右侧预览面板
```

---

## 5. 状态管理（historyStore 规划）

```typescript
interface HistoryStoreState {
  conversations: ConversationHistory[]
  loading: boolean
  totalCount: number
  search: string
  statusFilter: string
  modelFilter: string[]
  sort: string
  page: number
  selectedIds: Set<string>
}

// Actions
//   fetchList() / batchDelete() / batchArchive()
//   recover(id) / summarize(id) — Phase 2
```
