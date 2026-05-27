# HourMind — 仪表盘（首页）模块 技术设计规格

**日期**：2026-05-27
**版本**：v2.0（纯 SQLite 方案）
**范围**：核心 4 类（今日使用概览 + 快速入口 + 最近对话），待办部分依赖 tasks 模块

---

## 1. 架构决策

| 决策点 | 选择 |
|--------|------|
| 数据来源 | 纯聚合查询已有表（token_usage_records / messages / conversations），不新增数据库表 |
| 数据拉取方式 | 单一 action `dashboard.summary` 拉取全部数据 |
| 模型排行 | 从 token_usage_records 按 modelName 聚合 |
| 今日待办 | 依赖 tasks 模块，暂返回空数组 |
| 图表 | MVP 使用数字卡片展示，后续可引入图表库 |

---

## 2. 数据来源

| 展示内容 | 数据来源 | 查询方式 |
|---------|---------|---------|
| Token 消耗（今日/本月） | `token_usage_records` | 按 recordedAt 聚合 |
| 费用 | `token_usage_records` | 累加 estimatedCostCents |
| 对话次数 | `messages` | 按 createdAt 计数（role=user） |
| 活跃模型排行 | `token_usage_records` | 按 modelName 聚合排序 |
| 最近对话 | `Conversation` | 按 updatedAt 倒序，取 6 条 |
| 快速入口 | 前端静态配置 | 4 个卡片路由跳转 |

---

## 3. API 接口

### `dashboard.summary`

| 字段 | 说明 |
|------|------|
| payload | `period?` — `today` / `week` / `month`，默认 today |

**响应：**
```json
{
  "success": true,
  "data": {
    "usage": {
      "tokens_today": 12400,
      "tokens_month": 230000,
      "cost_cents_today": 120,
      "cost_cents_month": 2300,
      "conversations_today": 12,
      "conversations_month": 89
    },
    "model_ranking": [
      { "model": "deepseek-v4-pro", "tokens": 120000, "percentage": 52 },
      { "model": "gpt-4o", "tokens": 80000, "percentage": 35 }
    ],
    "recent_conversations": [
      { "id": "xxx", "title": "...", "model": "...", "updatedAt": "...", "messageCount": 5 }
    ],
    "today_tasks": []
  }
}
```

---

## 4. 前端路由与组件树（已实现）

### 路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | DashboardView | 首页仪表盘 |

### 组件树

```
views/
  └── DashboardView.vue                    # 仪表盘页面容器

components/dashboard/
  ├── DashboardWelcome.vue                 # 顶部欢迎栏（动态问候 + 日期 + 新对话按钮）
  ├── DashboardStatCards.vue               # 统计卡片行（今日 Token / 今日对话 / 本月费用）
  ├── DashboardQuickEntry.vue              # 快速入口（4 个玻璃卡片）
  └── DashboardRecentConversations.vue     # 最近对话列表
```

---

## 5. 状态管理（dashboardStore）

```typescript
// stores/dashboardStore.ts — 已实现

interface DashboardStoreState {
  summary: DashboardSummary | null
  loading: boolean
}

// Actions
//   fetchSummary() — 拉取全部仪表盘数据
```

### 状态覆盖矩阵

| 组件 | Loading | Empty | Error |
|------|---------|-------|-------|
| DashboardWelcome | — | 默认欢迎语 | — |
| DashboardStatCards | — | 显示 0 值 | 隐藏卡片 |
| DashboardQuickEntry | — | 始终显示（静态） | — |
| DashboardRecentConversations | 骨架卡片 | "还没有对话记录" | 隐藏区域 |

---

## 6. 与其他模块的交互

- 点击**新对话按钮** → 调 `conversations.create` → 导航到 `/chat`
- 点击**最近对话卡片** → 调 `selectConversation(id)` → 导航到 `/chat`
- 点击**快速入口** → 导航到对应路由
- 页面首次进入 → 调 `dashboard.summary`
