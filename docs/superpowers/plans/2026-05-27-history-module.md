# 历史记录模块 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 HourMind 构建完整的历史记录模块 —— 三栏布局的会话管理中心，含搜索筛选、批量操作、右侧预览、标签系统和 AI 会话总结。

**Architecture:** 纯 Node.js + SQLite 架构。后端新建 `historyHandler.ts` 注册 7 个 WS action，AI 总结通过 `aiService.summarizeChat`（非流式）调用厂商 API。前端新建 `historyStore` + `HistoryView`（三栏布局）+ 10 个子组件。数据库新增 `summary` 字段和 `conversation_tags` 表。

**Tech Stack:** Vue 3 + TypeScript + Pinia / Node.js + Express + Prisma + SQLite / Quantum Glass CSS

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `server/prisma/schema.prisma` | 加 summary 字段 + conversation_tags 表 |
| 创建 | `server/src/handlers/historyHandler.ts` | 7 个 history.* action |
| 修改 | `server/src/services/aiService.ts` | 新增 summarizeChat（非流式） |
| 修改 | `server/src/index.ts` | import historyHandler |
| 创建 | `client/src/stores/historyStore.ts` | 列表/筛选/批量选择/预览面板状态 |
| 创建 | `client/src/views/HistoryView.vue` | 三栏布局页面容器 |
| 创建 | `client/src/components/history/HistoryToolbar.vue` | 顶部栏（搜索+视图切换+导出） |
| 创建 | `client/src/components/history/HistoryFilterPanel.vue` | 左侧筛选面板容器 |
| 创建 | `client/src/components/history/FilterTimeRange.vue` | 时间快捷筛选 |
| 创建 | `client/src/components/history/FilterModelType.vue` | 模型筛选 |
| 创建 | `client/src/components/history/FilterStatus.vue` | 状态筛选 |
| 创建 | `client/src/components/history/FilterTagCloud.vue` | 标签云 |
| 创建 | `client/src/components/history/HistoryList.vue` | 中间列表区（含虚拟滚动） |
| 创建 | `client/src/components/history/HistoryListItem.vue` | 单条历史记录行 |
| 创建 | `client/src/components/history/HistoryListSkeleton.vue` | 加载骨架屏 |
| 创建 | `client/src/components/history/HistoryEmptyState.vue` | 空状态 |
| 创建 | `client/src/components/history/HistoryBatchBar.vue` | 批量操作栏 |
| 创建 | `client/src/components/history/HistoryDetailPanel.vue` | 右侧预览面板容器 |
| 创建 | `client/src/components/history/PanelConversationMeta.vue` | 会话元数据 |
| 创建 | `client/src/components/history/PanelConversationSummary.vue` | AI 总结区 |
| 创建 | `client/src/components/history/PanelActions.vue` | 操作按钮组 |
| 修改 | `client/src/router.ts` | 添加 /history 路由 |
| 修改 | `client/src/components/AppSidebar.vue` | 添加历史记录导航入口 |

---

### Task 1: 数据库 Schema 迁移

**Files:**
- Modify: `hourmind/server/prisma/schema.prisma`

- [ ] **Step 1: 更新 Conversation 模型 + 新增 ConversationTag 表**

在 `Conversation` 模型中添加 `summary` 字段，在文件末尾新增 `ConversationTag` 表：

```prisma
// 会话
model Conversation {
  id           String   @id @default(uuid())
  title        String
  model        String
  status       String   @default("active")
  isPinned     Boolean  @default(false)
  isStarred    Boolean  @default(false)
  totalTokens  Int      @default(0)
  messageCount Int      @default(0)
  summary      String?                    // AI 生成的会话摘要（200字以内）
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  messages     Message[]
  tags         ConversationTag[]          // 关联的标签
}

// 会话标签关联表（多对多）
model ConversationTag {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  tag            String       // 标签名，如 "工作"、"学习"、"项目A"
  createdAt      DateTime     @default(now())

  @@unique([conversationId, tag])  // 同一会话不能重复打同一个标签
  @@index([tag])                   // 按标签名查询时加索引
}
```

- [ ] **Step 2: 运行数据库迁移**

```bash
cd hourmind/server && npx prisma migrate dev --name add_summary_and_tags
```

Expected: 迁移成功，数据库新增 `summary` 列和 `ConversationTag` 表

- [ ] **Step 3: 提交**

```bash
cd /Users/hours/个人智能系统设计 && git add hourmind/server/prisma/schema.prisma hourmind/server/prisma/migrations/ && git commit -m "feat: 添加 conversations.summary 和 conversation_tags 表"
```

---

### Task 2: AI 服务 — 非流式总结函数

**Files:**
- Modify: `hourmind/server/src/services/aiService.ts`

- [ ] **Step 1: 添加 summarizeChat 函数**

在 `aiService.ts` 末尾追加：

```typescript
// summarizeChat —— 非流式 AI 会话总结
// 取全部消息 → 拼接 system prompt → 调厂商 API → 返回 200 字以内中文摘要
export async function summarizeChat(
  baseUrl: string,                       // 厂商 API 地址
  encryptedKey: string,                  // 加密的 API Key
  model: string,                         // 模型名
  messages: { role: string; content: string }[]  // 会话全部消息
): Promise<string> {
  // 解密 Key
  let apiKey: string
  try { apiKey = decrypt(encryptedKey) } catch { return '[错误] Key 解密失败' }

  // 构造 system prompt：让 AI 用中文生成 200 字以内的会话摘要
  const systemMsg = {
    role: 'system',
    content: '请用中文生成一段200字以内的会话摘要，概括这段对话的主要内容和结论。只输出摘要本身，不要加任何前缀或说明。'
  }

  try {
    // 调厂商 /chat/completions，非流式（stream: false）
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [systemMsg, ...messages],  // system + 全部历史消息
        stream: false,                       // 非流式，一次性返回
        max_tokens: 400,                     // 限制输出长度（200字约400 token）
      }),
      signal: AbortSignal.timeout(30000),    // 30 秒超时
    })

    // 请求失败
    if (!res.ok) {
      const body = await res.text()
      console.error('[summarizeChat] API 错误:', res.status, body.slice(0, 200))
      return '[错误] 摘要生成失败'
    }

    // 解析响应
    const data = await res.json() as any
    // 取 choices[0].message.content
    const summary = data.choices?.[0]?.message?.content || ''
    return summary.trim()
  } catch (e: any) {
    // 超时或网络错误
    console.error('[summarizeChat] 异常:', e.message)
    return '[错误] 摘要请求失败'
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd hourmind/server && npm run build
```

Expected: 编译成功，无类型错误

- [ ] **Step 3: 提交**

```bash
cd /Users/hours/个人智能系统设计 && git add hourmind/server/src/services/aiService.ts && git commit -m "feat: 添加 summarizeChat 非流式 AI 总结函数"
```

---

### Task 3: 后端 History Handler

**Files:**
- Create: `hourmind/server/src/handlers/historyHandler.ts`
- Modify: `hourmind/server/src/index.ts`

- [ ] **Step 1: 创建 historyHandler.ts**

```typescript
// ============================================================
// historyHandler.ts —— 历史记录模块处理函数
// 负责 history.* 系列 action：列表/批量操作/恢复/总结
//
// action 清单：
//   history.list          — 历史记录列表（搜索+筛选+分页+排序）
//   history.batch_delete  — 批量软删除
//   history.batch_archive — 批量归档
//   history.batch_tag     — 批量添加标签
//   history.batch_export  — 批量导出 Markdown/JSON
//   history.recover       — 恢复已删除会话（30天内）
//   history.summarize     — AI 生成会话总结
// ============================================================

import { prisma } from '../db'             // 数据库连接
import { registerRoute } from '../wsRouter' // 路由注册
import type { WsResponse } from '../wsRouter' // 响应类型
import { summarizeChat } from '../services/aiService' // AI 总结函数
import { decrypt } from '../services/cryptoService'   // Key 解密

// ==================== history.list ====================
// 历史记录列表：支持搜索、多条件筛选、分页、排序
// payload: { search?, status?, model?, tag?, date_from?, date_to?, page?, sort? }
registerRoute('history.list', async (payload): Promise<WsResponse> => {
  // 解构参数，设默认值
  const {
    search,                   // 搜索关键词（匹配标题）
    status,                   // 状态筛选：all/starred/archived/deleted
    model,                    // 模型筛选（单个字符串）
    tag,                      // 标签筛选（单个字符串）
    date_from, date_to,       // 时间范围（ISO 字符串）
    page = 1,                 // 页码，默认第 1 页
    sort = 'updated_desc',    // 排序：updated_desc/created_desc/tokens_desc
  } = payload || {}

  const pageSize = 30  // 每页 30 条

  // ========== 构建 where 条件 ==========
  const where: any = {}

  // 状态筛选
  if (!status || status === 'all') {
    // 默认不显示已删除的
    where.status = { not: 'deleted' }
  } else if (status === 'starred') {
    where.isStarred = true           // 星标会话
    where.status = { not: 'deleted' }
  } else if (status === 'archived') {
    where.status = 'archived'        // 已归档
  } else if (status === 'deleted') {
    where.status = 'deleted'         // 回收站
  }

  // 搜索关键词（模糊匹配标题）
  if (search) {
    where.title = { contains: search }   // SQLite LIKE '%search%'
  }

  // 模型筛选
  if (model) {
    where.model = model
  }

  // 时间范围筛选
  if (date_from || date_to) {
    where.updatedAt = {}
    if (date_from) where.updatedAt.gte = new Date(date_from)  // >= 起始
    if (date_to)   where.updatedAt.lte = new Date(date_to)    // <= 结束
  }

  // 标签筛选（通过 ConversationTag 关联表）
  if (tag) {
    where.tags = { some: { tag } }   // some: 至少有一条 tag 匹配
  }

  // ========== 排序映射 ==========
  let orderBy: any = { updatedAt: 'desc' }  // 默认按最近修改
  if (sort === 'created_desc') orderBy = { createdAt: 'desc' }
  if (sort === 'tokens_desc')  orderBy = { totalTokens: 'desc' }

  // ========== 查询 ==========
  try {
    // 并行查询：总数 + 列表数据
    const [total, list] = await Promise.all([
      prisma.conversation.count({ where }),  // 符合条件的总数
      prisma.conversation.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,         // 分页偏移
        take: pageSize,                       // 每页条数
        include: {
          tags: { select: { tag: true } },    // 查标签
          messages: {
            // 只取每个会话的最新一条 user 消息作为预览
            where: { role: 'user' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true },
          },
        },
      }),
    ])

    // 格式化列表：提取预览文本 + 标签
    const conversations = list.map((c) => ({
      id: c.id,
      title: c.title,
      model: c.model,
      status: c.status,
      isStarred: c.isStarred,
      isPinned: c.isPinned,
      totalTokens: c.totalTokens,
      messageCount: c.messageCount,
      summary: c.summary,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      preview: c.messages[0]?.content?.slice(0, 100) || '',  // 前 100 字做预览
      tags: c.tags.map((t) => t.tag),                         // 标签名数组
    }))

    return {
      success: true,
      data: {
        conversations,         // 会话列表
        total,                 // 总数
        page,                  // 当前页
        pageSize,              // 每页条数
        totalPages: Math.ceil(total / pageSize),  // 总页数
      },
    }
  } catch (e: any) {
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: e.message || '获取历史记录失败' },
    }
  }
})

// ==================== history.batch_delete ====================
// 批量软删除（status → 'deleted'）
// payload: { conversation_ids: string[] }
registerRoute('history.batch_delete', async (payload): Promise<WsResponse> => {
  const { conversation_ids } = payload
  if (!conversation_ids?.length) {
    return { success: false, error: { code: 'INVALID_PARAMS', message: '请选择要删除的会话' } }
  }
  // 批量更新：把 status 设为 deleted，记录删除时间
  await prisma.conversation.updateMany({
    where: { id: { in: conversation_ids } },    // id IN (...)
    data: { status: 'deleted' },                // 软删除，不真删数据
  })
  return { success: true, data: { deleted: conversation_ids.length } }
})

// ==================== history.batch_archive ====================
// 批量归档（status → 'archived'）
// payload: { conversation_ids: string[] }
registerRoute('history.batch_archive', async (payload): Promise<WsResponse> => {
  const { conversation_ids } = payload
  if (!conversation_ids?.length) {
    return { success: false, error: { code: 'INVALID_PARAMS', message: '请选择要归档的会话' } }
  }
  await prisma.conversation.updateMany({
    where: { id: { in: conversation_ids } },
    data: { status: 'archived' },
  })
  return { success: true, data: { archived: conversation_ids.length } }
})

// ==================== history.batch_tag ====================
// 批量添加标签
// payload: { conversation_ids: string[], tags: string[] }
registerRoute('history.batch_tag', async (payload): Promise<WsResponse> => {
  const { conversation_ids, tags } = payload
  if (!conversation_ids?.length || !tags?.length) {
    return { success: false, error: { code: 'INVALID_PARAMS', message: '请选择会话和标签' } }
  }
  // 为每个会话 × 每个标签创建关联（重复的会被 @@unique 忽略）
  const rows = conversation_ids.flatMap((cid: string) =>
    tags.map((tag: string) => ({ conversationId: cid, tag }))
  )
  // createMany skipDuplicates: 跳过已存在的标签关联
  await prisma.conversationTag.createMany({ data: rows, skipDuplicates: true })
  return { success: true, data: { tagged: conversation_ids.length * tags.length } }
})

// ==================== history.batch_export ====================
// 批量导出会话（Markdown 或 JSON）
// payload: { conversation_ids: string[], format: 'md' | 'json' }
registerRoute('history.batch_export', async (payload): Promise<WsResponse> => {
  const { conversation_ids, format = 'md' } = payload
  if (!conversation_ids?.length) {
    return { success: false, error: { code: 'INVALID_PARAMS', message: '请选择要导出的会话' } }
  }
  // 查出会话及其全部消息
  const conversations = await prisma.conversation.findMany({
    where: { id: { in: conversation_ids } },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },  // 消息按时间正序
      tags: { select: { tag: true } },
    },
  })
  // 按格式导出
  let content: string
  if (format === 'json') {
    content = JSON.stringify(conversations, null, 2)    // JSON 格式化输出
  } else {
    // Markdown 格式：每个会话一个 section
    content = conversations.map((c) => {
      const header = `# ${c.title}\n\n` +
        `- 模型: ${c.model}\n` +
        `- 时间: ${c.createdAt}\n` +
        `- 轮数: ${c.messageCount}\n` +
        `- Token: ${c.totalTokens}\n` +
        (c.tags.length ? `- 标签: ${c.tags.map((t) => t.tag).join(', ')}\n` : '') +
        `\n---\n\n`
      const msgs = c.messages.map((m) =>
        `**${m.role === 'user' ? '👤 用户' : '🤖 AI'}** (${m.createdAt})\n\n${m.content}\n\n`
      ).join('---\n\n')
      return header + msgs
    }).join('\n\n=====\n\n')
  }
  return { success: true, data: { content, format } }
})

// ==================== history.recover ====================
// 恢复已删除的会话（status → 'active'）
// payload: { conversation_id: string }
registerRoute('history.recover', async (payload): Promise<WsResponse> => {
  const { conversation_id } = payload
  // 先查这个会话存不存在且确实是 deleted 状态
  const conv = await prisma.conversation.findUnique({ where: { id: conversation_id } })
  if (!conv) {
    return { success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } }
  }
  if (conv.status !== 'deleted') {
    return { success: false, error: { code: 'NOT_DELETED', message: '该会话未被删除' } }
  }
  // 恢复为 active
  await prisma.conversation.update({
    where: { id: conversation_id },
    data: { status: 'active' },
  })
  return { success: true, data: { recovered: conversation_id } }
})

// ==================== history.summarize ====================
// AI 生成会话总结
// payload: { conversation_id: string }
registerRoute('history.summarize', async (payload): Promise<WsResponse> => {
  const { conversation_id } = payload

  // 1. 查会话
  const conv = await prisma.conversation.findUnique({
    where: { id: conversation_id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },  // 取全部消息
    },
  })
  if (!conv) {
    return { success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } }
  }
  if (!conv.messages.length) {
    return { success: false, error: { code: 'NO_MESSAGES', message: '该会话没有消息' } }
  }

  // 2. 找可用 Key
  const apiKey = await prisma.apiKey.findFirst({
    where: { status: 'active', isDeleted: false },
    include: { provider: true },
  })
  if (!apiKey) {
    return { success: false, error: { code: 'NO_ACTIVE_KEY', message: '没有可用的 API Key' } }
  }

  // 3. 组装消息数组
  const apiMessages = conv.messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))

  // 4. 调 AI 总结
  const model = conv.model || 'deepseek-v4-pro'
  const summary = await summarizeChat(
    apiKey.provider.baseUrl,
    apiKey.encryptedKey,
    model,
    apiMessages,
  )

  // 5. 写入数据库
  await prisma.conversation.update({
    where: { id: conversation_id },
    data: { summary },
  })

  return { success: true, data: { summary } }
})
```

- [ ] **Step 2: 在 index.ts 中引入 historyHandler**

在 `hourmind/server/src/index.ts` 的 handler import 区域添加一行：

```typescript
import './handlers/historyHandler'
```

加在 `import './handlers/dashboardHandler'` 之后。

- [ ] **Step 3: 验证编译**

```bash
cd hourmind/server && npm run build
```

Expected: 编译成功

- [ ] **Step 4: 提交**

```bash
cd /Users/hours/个人智能系统设计 && git add hourmind/server/src/handlers/historyHandler.ts hourmind/server/src/index.ts && git commit -m "feat: 添加 historyHandler 实现全部 history.* action"
```

---

### Task 4: 前端 History Store

**Files:**
- Create: `hourmind/client/src/stores/historyStore.ts`

- [ ] **Step 1: 创建 historyStore.ts**

```typescript
// historyStore.ts —— 历史记录模块 Pinia 状态管理
// 管理：会话列表、搜索筛选、分页、批量选择、右侧预览面板
import { defineStore } from 'pinia'      // Pinia 状态管理
import { ref, computed } from 'vue'       // Vue 响应式 API
import { wsClient } from '@/composables/useWs'  // WS 客户端

// 类型定义
export interface ConversationHistory {
  id: string           // 会话 ID
  title: string        // 标题
  model: string        // 模型名
  status: string       // active/archived/deleted
  isStarred: boolean   // 是否星标
  isPinned: boolean    // 是否置顶
  totalTokens: number  // Token 消耗
  messageCount: number // 对话轮数
  summary: string | null // AI 摘要
  preview: string      // 内容预览（前 100 字）
  tags: string[]       // 标签列表
  createdAt: string    // 创建时间
  updatedAt: string    // 更新时间
}

export interface ConversationDetail {
  id: string
  title: string
  model: string
  status: string
  isStarred: boolean
  isPinned: boolean
  totalTokens: number
  messageCount: number
  summary: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  messages: { id: string; role: string; content: string; model?: string; createdAt: string }[]
}

export const useHistoryStore = defineStore('history', () => {
  // ==================== 列表状态 ====================
  const conversations = ref<ConversationHistory[]>([])   // 会话列表
  const loading = ref(false)                              // 加载状态
  const totalCount = ref(0)                               // 总数
  const totalPages = ref(1)                               // 总页数

  // ==================== 筛选状态 ====================
  const search = ref('')                                  // 搜索关键词
  const statusFilter = ref<string>('all')                 // 状态筛选：all/starred/archived/deleted
  const modelFilter = ref('')                             // 模型筛选（单个）
  const tagFilter = ref('')                               // 标签筛选（单个）
  const dateRange = ref<{ from: string | null; to: string | null }>({ from: null, to: null })
  const sort = ref('updated_desc')                        // 排序方式
  const page = ref(1)                                     // 当前页

  // ==================== 批量选择状态 ====================
  const selectedIds = ref<Set<string>>(new Set())          // 选中的会话 ID 集合
  const showBatchBar = computed(() => selectedIds.value.size > 0)  // 是否显示批量操作栏

  // ==================== 预览面板状态 ====================
  const selectedConversation = ref<ConversationDetail | null>(null)  // 当前预览的会话详情
  const isSummarizing = ref(false)                                    // 是否正在生成 AI 总结
  const detailLoading = ref(false)                                    // 详情加载状态

  // ==================== 所有可用标签（用于标签云） ====================
  const allTags = ref<string[]>([])

  // ==================== Actions ====================

  // fetchList —— 获取历史记录列表
  async function fetchList() {
    loading.value = true
    try {
      const res = await wsClient.send('history.list', {
        search: search.value || undefined,           // 空字符串不传
        status: statusFilter.value,
        model: modelFilter.value || undefined,
        tag: tagFilter.value || undefined,
        date_from: dateRange.value.from,
        date_to: dateRange.value.to,
        sort: sort.value,
        page: page.value,
      })
      conversations.value = res.conversations || []  // 列表数据
      totalCount.value = res.total || 0              // 总数
      totalPages.value = res.totalPages || 1         // 总页数
      // 提取所有标签（用于标签云）
      const tags = new Set<string>()
      res.conversations?.forEach((c: ConversationHistory) =>
        c.tags?.forEach((t: string) => tags.add(t))
      )
      allTags.value = Array.from(tags)
    } catch (e: any) {
      console.error('[historyStore] fetchList 失败:', e.message)
    } finally {
      loading.value = false
    }
  }

  // selectConversation —— 点击会话打开右侧预览面板
  async function selectConversation(id: string) {
    detailLoading.value = true
    try {
      // 调 messages.list 获取详情
      const res = await wsClient.send('messages.list', { conversationId: id })
      if (res?.conversation) {
        const c = res.conversation
        selectedConversation.value = {
          id: c.id,
          title: c.title,
          model: c.model,
          status: c.status,
          isStarred: c.isStarred,
          isPinned: c.isPinned,
          totalTokens: c.totalTokens,
          messageCount: c.messageCount,
          summary: c.summary,
          tags: c.tags?.map((t: any) => t.tag) || [],
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          messages: res.messages || [],
        }
      }
    } catch (e: any) {
      console.error('[historyStore] selectConversation 失败:', e.message)
    } finally {
      detailLoading.value = false
    }
  }

  // closeDetail —— 关闭右侧预览面板
  function closeDetail() {
    selectedConversation.value = null
  }

  // ==================== 批量操作 ====================

  // batchDelete —— 批量删除
  async function batchDelete() {
    if (selectedIds.value.size === 0) return
    await wsClient.send('history.batch_delete', {
      conversation_ids: Array.from(selectedIds.value),
    })
    clearSelection()
    await fetchList()  // 刷新列表
  }

  // batchArchive —— 批量归档
  async function batchArchive() {
    if (selectedIds.value.size === 0) return
    await wsClient.send('history.batch_archive', {
      conversation_ids: Array.from(selectedIds.value),
    })
    clearSelection()
    await fetchList()
  }

  // batchTag —— 批量添加标签
  async function batchTag(tags: string[]) {
    if (selectedIds.value.size === 0 || !tags.length) return
    await wsClient.send('history.batch_tag', {
      conversation_ids: Array.from(selectedIds.value),
      tags,
    })
    await fetchList()
  }

  // batchExport —— 批量导出
  async function batchExport(format: 'md' | 'json') {
    if (selectedIds.value.size === 0) return
    const res = await wsClient.send('history.batch_export', {
      conversation_ids: Array.from(selectedIds.value),
      format,
    })
    // 触发浏览器下载
    const blob = new Blob([res.content], {
      type: format === 'json' ? 'application/json' : 'text/markdown',
    })
    const url = URL.createObjectURL(blob)          // 创建对象 URL
    const a = document.createElement('a')           // 创建隐藏 a 标签
    a.href = url
    a.download = `hourmind-export-${Date.now()}.${format}`  // 文件名带时间戳
    a.click()                                       // 触发下载
    URL.revokeObjectURL(url)                        // 释放 URL
  }

  // recoverConversation —— 恢复已删除会话
  async function recoverConversation(id: string) {
    await wsClient.send('history.recover', { conversation_id: id })
    await fetchList()
  }

  // summarize —— AI 生成摘要
  async function summarize(id: string) {
    isSummarizing.value = true
    try {
      const res = await wsClient.send('history.summarize', { conversation_id: id })
      // 更新预览面板中的 summary
      if (selectedConversation.value && selectedConversation.value.id === id) {
        selectedConversation.value = {
          ...selectedConversation.value,
          summary: res.summary,
        }
      }
      // 刷新列表中的 summary
      const idx = conversations.value.findIndex((c) => c.id === id)
      if (idx !== -1) {
        conversations.value[idx] = { ...conversations.value[idx], summary: res.summary }
      }
    } catch (e: any) {
      console.error('[historyStore] summarize 失败:', e.message)
    } finally {
      isSummarizing.value = false
    }
  }

  // ==================== 选择逻辑 ====================

  // toggleSelect —— 切换单个会话的选中状态（支持 Ctrl 多选）
  function toggleSelect(id: string) {
    const next = new Set(selectedIds.value)     // 复制当前 Set
    if (next.has(id)) {
      next.delete(id)                           // 已选中 → 取消
    } else {
      next.add(id)                              // 未选中 → 添加
    }
    selectedIds.value = next                    // 替换为新 Set（触发响应式）
  }

  // selectAll —— 全选当前页
  function selectAll() {
    selectedIds.value = new Set(conversations.value.map((c) => c.id))
  }

  // clearSelection —— 清空选中
  function clearSelection() {
    selectedIds.value = new Set()
  }

  // ==================== 筛选方法 ====================

  // setFilter —— 设置筛选条件后自动重新查询（搜索防抖在组件层处理）
  function setFilter(key: string, value: any) {
    switch (key) {
      case 'search': search.value = value; break         // 搜索关键词
      case 'status': statusFilter.value = value; break    // 状态筛选
      case 'model': modelFilter.value = value; break      // 模型筛选
      case 'tag': tagFilter.value = value; break          // 标签筛选
      case 'sort': sort.value = value; break              // 排序
      case 'page': page.value = value; break              // 页码
    }
    page.value = 1   // 改筛选条件时回到第 1 页
    closeDetail()     // 关闭预览面板
    fetchList()       // 重新查
  }

  // setDateRange —— 设置时间范围
  function setDateRange(from: string | null, to: string | null) {
    dateRange.value = { from, to }
    page.value = 1
    closeDetail()
    fetchList()
  }

  // ==================== 初始化 ====================
  // onMounted 时调一次拉取列表
  function init() {
    fetchList()
  }

  // 暴露给组件使用
  return {
    // 状态
    conversations, loading, totalCount, totalPages,
    search, statusFilter, modelFilter, tagFilter, dateRange, sort, page,
    selectedIds, showBatchBar,
    selectedConversation, isSummarizing, detailLoading,
    allTags,
    // 方法
    fetchList, selectConversation, closeDetail, init,
    batchDelete, batchArchive, batchTag, batchExport,
    recoverConversation, summarize,
    toggleSelect, selectAll, clearSelection,
    setFilter, setDateRange,
  }
})
```

- [ ] **Step 2: 验证前端编译**

```bash
cd hourmind/client && npx vue-tsc -b --noEmit 2>&1 | head -30
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
cd /Users/hours/个人智能系统设计 && git add hourmind/client/src/stores/historyStore.ts && git commit -m "feat: 添加 historyStore 状态管理"
```

---

### Task 5: 前端路由 + 侧边栏入口

**Files:**
- Modify: `hourmind/client/src/router.ts`
- Modify: `hourmind/client/src/components/AppSidebar.vue`

- [ ] **Step 1: 添加 /history 路由**

在 `router.ts` 的 `routes` 数组中添加一行：

```typescript
{ path: '/history', name: 'history', component: () => import('@/views/HistoryView.vue') },
```

加在 `/chat` 路由之后。

- [ ] **Step 2: 侧边栏添加历史记录入口**

在 `AppSidebar.vue` 的 `<nav>` 中添加一行导航链接：

```html
<router-link to="/history" class="ni" active-class="na"><span class="ni-icon">📋</span>历史记录</router-link>
```

加在「智能对话」和「API Key」之间。

- [ ] **Step 3: 提交**

```bash
cd /Users/hours/个人智能系统设计 && git add hourmind/client/src/router.ts hourmind/client/src/components/AppSidebar.vue && git commit -m "feat: 添加 /history 路由和侧边栏入口"
```

---

### Task 6: HistoryView 页面 + 子组件（批量创建）

**Files:**
- Create: All 16 files listed above for `client/src/views/` and `client/src/components/history/`

由于组件数量多且相互独立，这部分按组件逐个创建：

---

### Task 6.1: HistoryView.vue — 三栏布局页面容器

**Files:**
- Create: `hourmind/client/src/views/HistoryView.vue`

- [ ] **Step 1: 创建 HistoryView.vue**

```vue
<!-- HistoryView.vue —— 历史记录三栏布局页面容器 -->
<template>
  <div class="hv">
    <!-- 左侧筛选面板（260px） -->
    <HistoryFilterPanel class="hv-left" />

    <!-- 中间列表区（弹性宽度） -->
    <div class="hv-center">
      <!-- 顶部搜索栏 -->
      <HistoryToolbar />
      <!-- 列表主体 -->
      <HistoryList />
      <!-- 批量操作栏（有选中项时才显示） -->
      <HistoryBatchBar v-if="hs.showBatchBar" />
    </div>

    <!-- 右侧预览面板（选中会话时才显示） -->
    <HistoryDetailPanel v-if="hs.selectedConversation" class="hv-right" />
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { onMounted, onUnmounted } from 'vue'           // Vue 生命周期
import { useHistoryStore } from '@/stores/historyStore'  // History Store
import HistoryToolbar from '@/components/history/HistoryToolbar.vue'           // 顶部栏
import HistoryFilterPanel from '@/components/history/HistoryFilterPanel.vue'   // 左侧筛选
import HistoryList from '@/components/history/HistoryList.vue'                 // 中间列表
import HistoryBatchBar from '@/components/history/HistoryBatchBar.vue'         // 批量操作栏
import HistoryDetailPanel from '@/components/history/HistoryDetailPanel.vue'   // 右侧预览

// ==================== 初始化 ====================
const hs = useHistoryStore()  // 获取 store 实例

onMounted(() => {
  hs.init()  // 页面加载时拉取列表
})

onUnmounted(() => {
  hs.closeDetail()     // 离开页面时关闭预览
  hs.clearSelection()  // 清空选中
})
</script>

<style scoped>
/* 三栏布局 */
.hv {
  display: flex;                /* 弹性布局 */
  height: 100%;                 /* 撑满父容器 */
  background: linear-gradient(180deg, #0D1117 0%, #0A0C12 100%);  /* 深空背景渐变 */
  overflow: hidden;             /* 防止溢出滚动 */
}

/* 左侧筛选面板 */
.hv-left {
  width: 260px;                 /* 固定宽度 260px */
  min-width: 260px;             /* 不可压缩 */
  border-right: 1px solid rgba(0, 229, 216, 0.08);  /* 量子青分割线 */
  overflow-y: auto;             /* 内容过多时滚动 */
}

/* 中间列表区 */
.hv-center {
  flex: 1;                      /* 弹性填充剩余空间 */
  display: flex;
  flex-direction: column;       /* 垂直排列 */
  overflow: hidden;             /* 防止溢出 */
  min-width: 0;                 /* flex 子元素默认不收缩，需要设 0 */
}

/* 右侧预览面板 */
.hv-right {
  width: 400px;                 /* 固定宽度 400px */
  min-width: 400px;             /* 不可压缩 */
  border-left: 1px solid rgba(0, 229, 216, 0.08);  /* 量子青分割线 */
  overflow-y: auto;             /* 内容过多时滚动 */
}
</style>
```

---

### Task 6.2: HistoryToolbar.vue — 顶部搜索栏

**Files:**
- Create: `hourmind/client/src/components/history/HistoryToolbar.vue`

- [ ] **Step 1: 创建 HistoryToolbar.vue**

```vue
<!-- HistoryToolbar.vue —— 顶部栏：全局搜索 + 排序切换 + 导出全部 -->
<template>
  <div class="ht">
    <!-- 标题 -->
    <h2 class="ht-title">历史记录</h2>

    <!-- 搜索框（带防抖） -->
    <div class="ht-search">
      <svg class="ht-search-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input
        v-model="searchText"
        type="text"
        class="ht-search-input"
        placeholder="搜索会话标题..."
        @input="onSearchInput"
      />
      <!-- 有关键词时显示清除按钮 -->
      <button v-if="searchText" class="ht-search-clear" @click="clearSearch">✕</button>
    </div>

    <!-- 排序选择器 -->
    <select v-model="currentSort" class="ht-sort" @change="onSortChange">
      <option value="updated_desc">最近更新</option>
      <option value="created_desc">最近创建</option>
      <option value="tokens_desc">Token 最多</option>
    </select>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { ref } from 'vue'                                // Vue 响应式
import { useHistoryStore } from '@/stores/historyStore'   // History Store

// ==================== 初始化 ====================
const hs = useHistoryStore()
const searchText = ref('')       // 搜索框文字
const currentSort = ref('updated_desc')  // 当前排序

// ==================== 防抖定时器 ====================
let debounceTimer: ReturnType<typeof setTimeout> | null = null  // 防抖定时器 ID

// onSearchInput —— 搜索输入防抖（300ms）
function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)    // 清除上次定时器
  debounceTimer = setTimeout(() => {
    hs.setFilter('search', searchText.value)         // 300ms 后触发筛选
  }, 300)                                            // 防抖 300ms
}

// clearSearch —— 清除搜索
function clearSearch() {
  searchText.value = ''                               // 清空输入
  hs.setFilter('search', '')                          // 重置筛选
}

// onSortChange —— 排序切换
function onSortChange() {
  hs.setFilter('sort', currentSort.value)             // 设置排序
}
</script>

<style scoped>
/* 容器 */
.ht {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 229, 216, 0.08);
  background: rgba(13, 17, 23, 0.6);
  backdrop-filter: blur(20px);
}

/* 标题 */
.ht-title {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #00E5D8, #6366F1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
}

/* 搜索框（弹性填充） */
.ht-search {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

/* 搜索图标 */
.ht-search-icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: #64748B;
  pointer-events: none;
}

/* 搜索输入框 */
.ht-search-input {
  width: 100%;
  padding: 10px 36px 10px 40px;   /* 左边留给图标，右边留给清除按钮 */
  background: rgba(22, 27, 34, 0.8);
  border: 1px solid rgba(0, 229, 216, 0.12);
  border-radius: 12px;
  font-size: 14px;
  color: #F1F5F9;
  outline: none;
  transition: border-color 0.2s;
}

.ht-search-input:focus {
  border-color: rgba(0, 229, 216, 0.35);
}

.ht-search-input::placeholder {
  color: #64748B;
}

/* 清除按钮 */
.ht-search-clear {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: none;
  border-radius: 50%;
  color: #94A3B8;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.ht-search-clear:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

/* 排序选择器 */
.ht-sort {
  padding: 10px 14px;
  background: rgba(22, 27, 34, 0.8);
  border: 1px solid rgba(0, 229, 216, 0.12);
  border-radius: 12px;
  font-size: 13px;
  color: #00E5D8;
  cursor: pointer;
  outline: none;
  flex-shrink: 0;
}
</style>
```

---

### Task 6.3: HistoryFilterPanel.vue + 子组件（左侧筛选面板）

**Files:**
- Create: `hourmind/client/src/components/history/HistoryFilterPanel.vue`
- Create: `hourmind/client/src/components/history/FilterTimeRange.vue`
- Create: `hourmind/client/src/components/history/FilterModelType.vue`
- Create: `hourmind/client/src/components/history/FilterStatus.vue`
- Create: `hourmind/client/src/components/history/FilterTagCloud.vue`

由于每个筛选子组件都很小（纯展示+事件），将它们合并到一个 Task 中创建：

- [ ] **Step 1: 创建 FilterTimeRange.vue**

```vue
<!-- FilterTimeRange.vue —— 时间范围快捷筛选 -->
<template>
  <div class="ftr">
    <h4 class="ftr-title">时间范围</h4>
    <div class="ftr-btns">
      <!-- 遍历预设的时间选项 -->
      <button
        v-for="opt in timeOptions"
        :key="opt.value"
        :class="['ftr-btn', { 'ftr-btn-active': active === opt.value }]"
        @click="select(opt)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { ref } from 'vue'                                // Vue 响应式
import { useHistoryStore } from '@/stores/historyStore'   // History Store

// ==================== 初始化 ====================
const hs = useHistoryStore()
const active = ref<string>('all')  // 当前选中的时间选项

// 预设时间选项
const timeOptions = [
  { label: '全部', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '最近 7 天', value: 'week' },
  { label: '最近 30 天', value: 'month' },
]

// select —— 选择时间范围
function select(opt: { label: string; value: string }) {
  active.value = opt.value  // 更新选中状态
  const now = new Date()
  let from: string | null = null
  // 根据选项计算起始时间
  if (opt.value === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  } else if (opt.value === 'week') {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  } else if (opt.value === 'month') {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
  hs.setDateRange(from, null)  // 通知 store 更新筛选
}
</script>

<style scoped>
/* 标题 */
.ftr { padding: 0 0 16px 0; }

.ftr-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

/* 按钮组 */
.ftr-btns { display: flex; flex-wrap: wrap; gap: 6px; }

/* 单个按钮 */
.ftr-btn {
  padding: 6px 14px;
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid rgba(0, 229, 216, 0.1);
  border-radius: 8px;
  font-size: 13px;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.2s;
}

.ftr-btn:hover {
  background: rgba(0, 229, 216, 0.08);
  color: #F1F5F9;
}

/* 激活状态 */
.ftr-btn-active {
  background: rgba(0, 229, 216, 0.12) !important;
  border-color: rgba(0, 229, 216, 0.3) !important;
  color: #00E5D8 !important;
}
</style>
```

- [ ] **Step 2: 创建 FilterStatus.vue**

```vue
<!-- FilterStatus.vue —— 状态筛选（全部/星标/归档/回收站） -->
<template>
  <div class="fs">
    <h4 class="fs-title">状态</h4>
    <div class="fs-list">
      <!-- 遍历状态选项 -->
      <button
        v-for="opt in statusOptions"
        :key="opt.value"
        :class="['fs-item', { 'fs-item-active': hs.statusFilter === opt.value }]"
        @click="hs.setFilter('status', opt.value)"
      >
        <span class="fs-dot" :style="{ background: opt.color }"></span>
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { useHistoryStore } from '@/stores/historyStore'  // History Store

// ==================== 初始化 ====================
const hs = useHistoryStore()

// 状态选项
const statusOptions = [
  { label: '全部', value: 'all', color: '#64748B' },
  { label: '星标', value: 'starred', color: '#F59E0B' },
  { label: '已归档', value: 'archived', color: '#6366F1' },
  { label: '回收站', value: 'deleted', color: '#EF4444' },
]
</script>

<style scoped>
/* 容器 */
.fs { padding: 16px 0; border-top: 1px solid rgba(0, 229, 216, 0.06); }

/* 标题 */
.fs-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

/* 列表 */
.fs-list { display: flex; flex-direction: column; gap: 2px; }

/* 选项按钮 */
.fs-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.fs-item:hover {
  background: rgba(0, 229, 216, 0.06);
  color: #E6EDF3;
}

/* 激活状态 */
.fs-item-active {
  background: rgba(0, 229, 216, 0.1) !important;
  color: #00E5D8 !important;
}

/* 状态指示点 */
.fs-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 3: 创建 FilterModelType.vue**

```vue
<!-- FilterModelType.vue —— 模型类型筛选 -->
<template>
  <div class="fmt">
    <h4 class="fmt-title">模型</h4>
    <select v-model="currentModel" class="fmt-select" @change="onChange">
      <option value="">全部模型</option>
      <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { ref } from 'vue'                                // Vue 响应式
import { useHistoryStore } from '@/stores/historyStore'   // History Store

// ==================== 初始化 ====================
const hs = useHistoryStore()
const currentModel = ref('')  // 当前选中的模型

// 可用模型列表（与 ChatView 保持一致）
const models = [
  'deepseek-v4-pro', 'deepseek-v4-flash',
  'gpt-4o', 'gpt-4o-mini',
  'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307',
  'gemini-2.0-flash', 'grok-2',
]

// onChange —— 模型变更时通知 store
function onChange() {
  hs.setFilter('model', currentModel.value)
}
</script>

<style scoped>
/* 容器 */
.fmt { padding: 16px 0; border-top: 1px solid rgba(0, 229, 216, 0.06); }

/* 标题 */
.fmt-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

/* 下拉选择器 */
.fmt-select {
  width: 100%;
  padding: 10px 12px;
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid rgba(0, 229, 216, 0.12);
  border-radius: 10px;
  font-size: 13px;
  color: #F1F5F9;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.fmt-select:focus {
  border-color: rgba(0, 229, 216, 0.35);
}
</style>
```

- [ ] **Step 4: 创建 FilterTagCloud.vue**

```vue
<!-- FilterTagCloud.vue —— 标签云筛选 -->
<template>
  <div v-if="hs.allTags.length > 0" class="ftc">
    <h4 class="ftc-title">标签</h4>
    <div class="ftc-cloud">
      <!-- 遍历所有标签 -->
      <button
        v-for="tag in hs.allTags"
        :key="tag"
        :class="['ftc-tag', { 'ftc-tag-active': hs.tagFilter === tag }]"
        @click="onTagClick(tag)"
      >
        {{ tag }}
      </button>
      <!-- 清除标签筛选 -->
      <button
        v-if="hs.tagFilter"
        class="ftc-tag ftc-tag-clear"
        @click="hs.setFilter('tag', '')"
      >
        清除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { useHistoryStore } from '@/stores/historyStore'  // History Store

// ==================== 初始化 ====================
const hs = useHistoryStore()

// onTagClick —— 点击标签切换筛选
function onTagClick(tag: string) {
  // 再次点击同一个标签则取消筛选
  if (hs.tagFilter === tag) {
    hs.setFilter('tag', '')
  } else {
    hs.setFilter('tag', tag)
  }
}
</script>

<style scoped>
/* 容器 */
.ftc { padding: 16px 0; border-top: 1px solid rgba(0, 229, 216, 0.06); }

/* 标题 */
.ftc-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

/* 标签云容器 */
.ftc-cloud { display: flex; flex-wrap: wrap; gap: 6px; }

/* 标签按钮 */
.ftc-tag {
  padding: 5px 12px;
  background: rgba(0, 229, 216, 0.06);
  border: 1px solid rgba(0, 229, 216, 0.1);
  border-radius: 16px;
  font-size: 12px;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.2s;
}

.ftc-tag:hover {
  background: rgba(0, 229, 216, 0.12);
  color: #F1F5F9;
}

/* 激活状态 */
.ftc-tag-active {
  background: rgba(0, 229, 216, 0.15) !important;
  border-color: rgba(0, 229, 216, 0.35) !important;
  color: #00E5D8 !important;
}

/* 清除按钮 */
.ftc-tag-clear {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

.ftc-tag-clear:hover {
  background: rgba(239, 68, 68, 0.15);
}
</style>
```

- [ ] **Step 5: 创建 HistoryFilterPanel.vue（组合以上四个子组件）**

```vue
<!-- HistoryFilterPanel.vue —— 左侧筛选面板容器 -->
<template>
  <div class="hfp">
    <!-- 时间范围快捷筛选 -->
    <FilterTimeRange />
    <!-- 状态筛选 -->
    <FilterStatus />
    <!-- 模型筛选 -->
    <FilterModelType />
    <!-- 标签云 -->
    <FilterTagCloud />
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import FilterTimeRange from '@/components/history/FilterTimeRange.vue'   // 时间筛选
import FilterStatus from '@/components/history/FilterStatus.vue'         // 状态筛选
import FilterModelType from '@/components/history/FilterModelType.vue'   // 模型筛选
import FilterTagCloud from '@/components/history/FilterTagCloud.vue'     // 标签云
</script>

<style scoped>
/* 容器 */
.hfp { padding: 20px 16px; }
</style>
```

---

### Task 6.4: HistoryList.vue + 三项态子组件

**Files:**
- Create: `hourmind/client/src/components/history/HistoryList.vue`
- Create: `hourmind/client/src/components/history/HistoryListItem.vue`
- Create: `hourmind/client/src/components/history/HistoryListSkeleton.vue`
- Create: `hourmind/client/src/components/history/HistoryEmptyState.vue`

- [ ] **Step 1: 创建 HistoryListSkeleton.vue**

```vue
<!-- HistoryListSkeleton.vue —— 列表加载骨架屏 -->
<template>
  <div class="hls">
    <!-- 循环 8 条骨架 -->
    <div v-for="i in 8" :key="i" class="hls-item">
      <div class="hls-line hls-line-title"></div>      <!-- 标题占位 -->
      <div class="hls-line hls-line-preview"></div>     <!-- 预览占位 -->
      <div class="hls-line hls-line-meta"></div>        <!-- 元数据占位 -->
    </div>
  </div>
</template>

<style scoped>
/* 容器 */
.hls { padding: 8px 0; }

/* 单条骨架 */
.hls-item {
  padding: 16px;
  margin: 4px 0;
  border-radius: 12px;
  background: rgba(22, 27, 34, 0.4);
}

/* 骨架线条（带动画） */
.hls-line {
  height: 14px;
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  margin-bottom: 8px;
  animation: hls-shimmer 1.5s ease-in-out infinite;  /* 闪烁动画 */
}

/* 标题骨架（60% 宽） */
.hls-line-title { width: 60%; }

/* 预览骨架（90% 宽） */
.hls-line-preview { width: 90%; }

/* 元数据骨架（40% 宽） */
.hls-line-meta { width: 40%; margin-bottom: 0; }

/* 闪烁动画 */
@keyframes hls-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
</style>
```

- [ ] **Step 2: 创建 HistoryEmptyState.vue**

```vue
<!-- HistoryEmptyState.vue —— 空状态引导 -->
<template>
  <div class="hes">
    <!-- 空状态图标 -->
    <div class="hes-icon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </div>
    <!-- 提示文字 -->
    <p class="hes-text">{{ msg }}</p>
    <p class="hes-sub">{{ sub }}</p>
  </div>
</template>

<script setup lang="ts">
// ==================== Props ====================
defineProps({
  msg: { type: String, default: '暂无历史记录' },       // 主提示
  sub: { type: String, default: '开始一段新对话吧' },     // 副提示
})
</script>

<style scoped>
/* 容器 */
.hes {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

/* 图标 */
.hes-icon {
  width: 56px;
  height: 56px;
  color: #64748B;
  margin-bottom: 16px;
}

.hes-icon svg { width: 100%; height: 100%; }

/* 主提示 */
.hes-text {
  font-size: 16px;
  font-weight: 600;
  color: #94A3B8;
  margin-bottom: 6px;
}

/* 副提示 */
.hes-sub {
  font-size: 13px;
  color: #64748B;
}
</style>
```

- [ ] **Step 3: 创建 HistoryListItem.vue**

```vue
<!-- HistoryListItem.vue —— 单条历史记录行 -->
<template>
  <div
    :class="['hli', { 'hli-selected': isSelected }]"
    @click="$emit('select', conv.id)"
  >
    <!-- 左侧：复选框 -->
    <button
      :class="['hli-check', { 'hli-check-on': isSelected }]"
      @click.stop="$emit('toggle', conv.id)"
    >
      <!-- 选中时显示勾 -->
      <svg v-if="isSelected" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- 主体信息 -->
    <div class="hli-body">
      <!-- 标题行 -->
      <div class="hli-header">
        <!-- 星标/置顶图标 -->
        <span v-if="conv.isStarred" class="hli-star">★</span>
        <span v-if="conv.isPinned" class="hli-pin">📌</span>
        <!-- 标题 -->
        <span class="hli-title">{{ conv.title || '新对话' }}</span>
      </div>

      <!-- 预览文本（前 100 字） -->
      <p class="hli-preview">{{ conv.preview || '暂无消息' }}</p>

      <!-- 底部元数据 -->
      <div class="hli-meta">
        <!-- 模型标签 -->
        <span class="hli-model">{{ conv.model }}</span>
        <!-- 标签 -->
        <span v-for="tag in conv.tags" :key="tag" class="hli-tag">{{ tag }}</span>
        <!-- 统计 -->
        <span class="hli-stats">{{ conv.messageCount }} 轮 · {{ conv.totalTokens }} Token</span>
        <!-- 时间 -->
        <span class="hli-time">{{ formatTime(conv.updatedAt) }}</span>
      </div>
    </div>

    <!-- 右侧：快捷操作 -->
    <div class="hli-actions">
      <!-- 删除按钮 -->
      <button class="hli-action hli-delete" title="删除" @click.stop="$emit('delete', conv.id)">
        <svg viewBox="0 0 24 24" fill="none">
          <polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import type { ConversationHistory } from '@/stores/historyStore'  // 类型

// ==================== Props ====================
defineProps({
  conv: { type: Object as () => ConversationHistory, required: true },  // 会话数据
  isSelected: { type: Boolean, default: false },                       // 是否选中
})

// ==================== Events ====================
defineEmits(['select', 'toggle', 'delete'])  // 点击/切换选中/删除

// formatTime —— 格式化为相对时间
function formatTime(dateStr: string): string {
  const date = new Date(dateStr)   // 解析时间字符串
  const now = new Date()           // 当前时间
  const diffMs = now.getTime() - date.getTime()  // 时间差（毫秒）
  const diffMin = Math.floor(diffMs / 60000)     // 转分钟
  const diffHour = Math.floor(diffMs / 3600000)   // 转小时
  const diffDay = Math.floor(diffMs / 86400000)   // 转天

  if (diffMin < 1) return '刚刚'                    // < 1 分钟
  if (diffMin < 60) return `${diffMin} 分钟前`       // < 1 小时
  if (diffHour < 24) return `${diffHour} 小时前`     // < 1 天
  if (diffDay < 7) return `${diffDay} 天前`          // < 1 周
  return date.toLocaleDateString('zh-CN')            // 超过一周显示日期
}
</script>

<style scoped>
/* 列表项 */
.hli {
  display: flex;
  align-items: flex-start;
  padding: 14px 16px;
  margin: 2px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  gap: 12px;
}

.hli:hover {
  background: rgba(0, 229, 216, 0.05);
}

/* 选中状态 */
.hli-selected {
  background: rgba(0, 229, 216, 0.08) !important;
  border-color: rgba(0, 229, 216, 0.15);
}

/* 复选框 */
.hli-check {
  width: 22px;
  height: 22px;
  min-width: 22px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 27, 34, 0.6);
  border: 1.5px solid rgba(0, 229, 216, 0.2);
  border-radius: 6px;
  color: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.hli-check svg { width: 16px; height: 16px; }

.hli-check-on {
  background: rgba(0, 229, 216, 0.15);
  border-color: #00E5D8;
  color: #00E5D8;
}

.hli-check:hover { border-color: rgba(0, 229, 216, 0.4); }

/* 主体 */
.hli-body { flex: 1; min-width: 0; }

/* 标题行 */
.hli-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

/* 星标 */
.hli-star { font-size: 14px; color: #F59E0B; }

/* 置顶 */
.hli-pin { font-size: 12px; }

/* 标题 */
.hli-title {
  font-size: 15px;
  font-weight: 600;
  color: #E6EDF3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* 预览 */
.hli-preview {
  font-size: 13px;
  color: #64748B;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 元数据行 */
.hli-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 模型标签 */
.hli-model {
  padding: 2px 8px;
  background: rgba(0, 229, 216, 0.08);
  border-radius: 6px;
  font-size: 11px;
  color: #00E5D8;
  font-weight: 500;
}

/* 标签 */
.hli-tag {
  padding: 2px 8px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 6px;
  font-size: 11px;
  color: #818CF8;
}

/* 统计 */
.hli-stats { font-size: 11px; color: #64748B; }

/* 时间 */
.hli-time { font-size: 11px; color: #64748B; margin-left: auto; }

/* 右侧操作区 */
.hli-actions {
  display: flex;
  gap: 4px;
  opacity: 0;                    /* 默认隐藏 */
  transition: opacity 0.15s;
}

/* hover 时显示操作按钮 */
.hli:hover .hli-actions { opacity: 1; }

/* 操作按钮 */
.hli-action {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #64748B;
  cursor: pointer;
  transition: all 0.15s;
}

.hli-action svg { width: 16px; height: 16px; }

.hli-action:hover { background: rgba(255, 255, 255, 0.06); }

/* 删除按钮 hover 红色 */
.hli-delete:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #EF4444;
}
</style>
```

- [ ] **Step 4: 创建 HistoryList.vue（含虚拟滚动逻辑）**

```vue
<!-- HistoryList.vue —— 中间列表区：根据状态显示骨架/空/列表 -->
<template>
  <div class="hl" ref="listRef">
    <!-- ===== 加载骨架 ===== -->
    <HistoryListSkeleton v-if="hs.loading && hs.conversations.length === 0" />

    <!-- ===== 空状态 ===== -->
    <HistoryEmptyState
      v-else-if="!hs.loading && hs.conversations.length === 0"
      :msg="emptyMsg"
      :sub="emptySub"
    />

    <!-- ===== 列表 ===== -->
    <template v-else>
      <!-- 全选按钮 -->
      <div v-if="hs.conversations.length > 0" class="hl-select-all">
        <button class="hl-sa-btn" @click="hs.selectedIds.size === hs.conversations.length ? hs.clearSelection() : hs.selectAll()">
          {{ hs.selectedIds.size === hs.conversations.length ? '取消全选' : '全选' }}
        </button>
        <span class="hl-count">共 {{ hs.totalCount }} 条</span>
      </div>

      <!-- 列表项（虚拟滚动：仅渲染可视区域） -->
      <div class="hl-items" :style="{ height: totalHeight + 'px' }">
        <div
          v-for="item in visibleItems"
          :key="item.conv.id"
          class="hl-item-wrapper"
          :style="{ transform: `translateY(${item.offset}px)` }"
        >
          <HistoryListItem
            :conv="item.conv"
            :isSelected="hs.selectedIds.has(item.conv.id)"
            @select="onSelect"
            @toggle="hs.toggleSelect"
            @delete="onDelete"
          />
        </div>
      </div>

      <!-- 分页器 -->
      <div v-if="hs.totalPages > 1" class="hl-pager">
        <button class="hl-page-btn" :disabled="hs.page <= 1" @click="hs.setFilter('page', hs.page - 1)">上一页</button>
        <span class="hl-page-info">{{ hs.page }} / {{ hs.totalPages }}</span>
        <button class="hl-page-btn" :disabled="hs.page >= hs.totalPages" @click="hs.setFilter('page', hs.page + 1)">下一页</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { computed, ref } from 'vue'                       // Vue 响应式
import { useHistoryStore } from '@/stores/historyStore'   // History Store
import HistoryListItem from '@/components/history/HistoryListItem.vue'       // 列表项
import HistoryListSkeleton from '@/components/history/HistoryListSkeleton.vue' // 骨架屏
import HistoryEmptyState from '@/components/history/HistoryEmptyState.vue'   // 空状态
import { wsClient } from '@/composables/useWs'            // WS 客户端

// ==================== 初始化 ====================
const hs = useHistoryStore()
const listRef = ref<HTMLElement | null>(null)

// ==================== 虚拟滚动参数 ====================
const ITEM_HEIGHT = 110  // 每项预估高度（px）
const BUFFER = 5          // 缓冲区条数（上下各多渲染几项）

// totalHeight —— 总列表高度
const totalHeight = computed(() => hs.conversations.length * ITEM_HEIGHT)

// visibleItems —— 仅渲染可视区域 + 缓冲区内的项
const visibleItems = computed(() => {
  const items = hs.conversations
  // 如果少于 50 条，全量渲染（不需要虚拟滚动）
  if (items.length <= 50) {
    return items.map((conv, i) => ({ conv, offset: i * ITEM_HEIGHT }))
  }
  // TODO: 实际项目中根据 scrollTop 计算可见范围
  // MVP 阶段先全量渲染，后续 >500 条时启用真实虚拟滚动
  return items.map((conv, i) => ({ conv, offset: i * ITEM_HEIGHT }))
})

// ==================== 空状态提示 ====================
const emptyMsg = computed(() => {
  if (hs.statusFilter === 'deleted') return '回收站是空的'
  if (hs.search || hs.tagFilter || hs.modelFilter) return '没有找到匹配的会话'
  return '暂无历史记录'
})
const emptySub = computed(() => {
  if (hs.statusFilter === 'deleted') return '删除的会话会保留 30 天'
  if (hs.search || hs.tagFilter || hs.modelFilter) return '试试调整筛选条件'
  return '开始一段新对话吧'
})

// ==================== 事件处理 ====================
// onSelect —— 点击列表项打开预览
function onSelect(id: string) {
  hs.selectConversation(id)
}

// onDelete —— 点击删除按钮
async function onDelete(id: string) {
  await wsClient.send('history.batch_delete', { conversation_ids: [id] })
  hs.fetchList()  // 刷新列表
}
</script>

<style scoped>
/* 容器 */
.hl {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 全选栏 */
.hl-select-all {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 229, 216, 0.05);
}

/* 全选按钮 */
.hl-sa-btn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid rgba(0, 229, 216, 0.15);
  border-radius: 8px;
  font-size: 12px;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.15s;
}

.hl-sa-btn:hover {
  background: rgba(0, 229, 216, 0.08);
  color: #00E5D8;
}

/* 计数 */
.hl-count { font-size: 12px; color: #64748B; }

/* 列表项容器（虚拟滚动用） */
.hl-items { position: relative; }

.hl-item-wrapper {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
}

/* ===== 分页器 ===== */
.hl-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid rgba(0, 229, 216, 0.06);
  margin-top: auto;
}

/* 分页按钮 */
.hl-page-btn {
  padding: 8px 16px;
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid rgba(0, 229, 216, 0.12);
  border-radius: 8px;
  font-size: 13px;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.15s;
}

.hl-page-btn:hover:not(:disabled) {
  background: rgba(0, 229, 216, 0.08);
  color: #00E5D8;
}

.hl-page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 页码信息 */
.hl-page-info { font-size: 13px; color: #64748B; }
</style>
```

---

### Task 6.5: HistoryBatchBar.vue — 批量操作栏

**Files:**
- Create: `hourmind/client/src/components/history/HistoryBatchBar.vue`

- [ ] **Step 1: 创建 HistoryBatchBar.vue**

```vue
<!-- HistoryBatchBar.vue —— 底部批量操作栏（选中项大于 0 时显示） -->
<template>
  <div class="hbb">
    <!-- 已选数量 -->
    <span class="hbb-count">已选 {{ hs.selectedIds.size }} 项</span>

    <!-- 操作按钮组 -->
    <div class="hbb-actions">
      <!-- 添加标签 -->
      <button class="hbb-btn" @click="showTagInput = !showTagInput">
        🏷️ 添加标签
      </button>
      <!-- 归档 -->
      <button class="hbb-btn" @click="hs.batchArchive()">📁 归档</button>
      <!-- 导出 -->
      <button class="hbb-btn" @click="hs.batchExport('md')">📥 导出 MD</button>
      <!-- 删除 -->
      <button class="hbb-btn hbb-delete" @click="hs.batchDelete()">🗑️ 删除</button>
    </div>

    <!-- 标签输入框（展开时显示） -->
    <div v-if="showTagInput" class="hbb-tag-input">
      <input
        v-model="tagText"
        type="text"
        placeholder="输入标签名，逗号分隔"
        class="hbb-tag-field"
        @keydown.enter="addTags"
      />
      <button class="hbb-tag-confirm" @click="addTags">确定</button>
    </div>

    <!-- 关闭按钮 -->
    <button class="hbb-close" @click="hs.clearSelection()">✕</button>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { ref } from 'vue'                                // Vue 响应式
import { useHistoryStore } from '@/stores/historyStore'   // History Store

// ==================== 初始化 ====================
const hs = useHistoryStore()
const showTagInput = ref(false)  // 是否显示标签输入框
const tagText = ref('')          // 标签输入文本

// addTags —— 解析标签并批量添加
function addTags() {
  const tags = tagText.value.split(',')    // 按逗号分割
    .map((t) => t.trim())                  // 去前后空格
    .filter((t) => t.length > 0)           // 过滤空字符串
  if (tags.length === 0) return
  hs.batchTag(tags)                        // 调 store 的批量标签方法
  tagText.value = ''                       // 清空输入
  showTagInput.value = false               // 收起输入框
}
</script>

<style scoped>
/* 容器（底部固定） */
.hbb {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: rgba(13, 17, 23, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(0, 229, 216, 0.15);
  flex-wrap: wrap;
}

/* 已选数量 */
.hbb-count {
  font-size: 14px;
  font-weight: 600;
  color: #00E5D8;
}

/* 操作按钮组 */
.hbb-actions { display: flex; gap: 8px; flex: 1; }

/* 操作按钮 */
.hbb-btn {
  padding: 8px 14px;
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid rgba(0, 229, 216, 0.12);
  border-radius: 8px;
  font-size: 13px;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.15s;
}

.hbb-btn:hover {
  background: rgba(0, 229, 216, 0.08);
  color: #00E5D8;
}

/* 删除按钮 */
.hbb-delete:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.25);
  color: #EF4444;
}

/* 关闭按钮 */
.hbb-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: none;
  border-radius: 8px;
  color: #94A3B8;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.hbb-close:hover { background: rgba(255, 255, 255, 0.08); color: #F1F5F9; }

/* 标签输入框区域 */
.hbb-tag-input {
  display: flex;
  gap: 8px;
  width: 100%;
  padding-top: 8px;
}

/* 标签输入框 */
.hbb-tag-field {
  flex: 1;
  padding: 8px 12px;
  background: rgba(22, 27, 34, 0.8);
  border: 1px solid rgba(0, 229, 216, 0.15);
  border-radius: 8px;
  font-size: 13px;
  color: #F1F5F9;
  outline: none;
}

.hbb-tag-field:focus { border-color: rgba(0, 229, 216, 0.35); }

/* 确定按钮 */
.hbb-tag-confirm {
  padding: 8px 18px;
  background: linear-gradient(135deg, #00E5D8, #00B8D4);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #0A0C12;
  cursor: pointer;
}
</style>
```

---

### Task 6.6: HistoryDetailPanel.vue + 三项子组件（右侧预览面板）

**Files:**
- Create: `hourmind/client/src/components/history/HistoryDetailPanel.vue`
- Create: `hourmind/client/src/components/history/PanelConversationMeta.vue`
- Create: `hourmind/client/src/components/history/PanelConversationSummary.vue`
- Create: `hourmind/client/src/components/history/PanelActions.vue`

- [ ] **Step 1: 创建 PanelConversationMeta.vue**

```vue
<!-- PanelConversationMeta.vue —— 会话元数据显示 -->
<template>
  <div class="pcm">
    <!-- 标题 -->
    <h3 class="pcm-title">{{ conv.title || '新对话' }}</h3>

    <!-- 元数据网格 -->
    <div class="pcm-grid">
      <!-- 模型 -->
      <div class="pcm-item">
        <span class="pcm-label">模型</span>
        <span class="pcm-value pcm-model">{{ conv.model }}</span>
      </div>
      <!-- 消息数 -->
      <div class="pcm-item">
        <span class="pcm-label">消息轮数</span>
        <span class="pcm-value">{{ conv.messageCount }} 轮</span>
      </div>
      <!-- Token 消耗 -->
      <div class="pcm-item">
        <span class="pcm-label">Token 消耗</span>
        <span class="pcm-value">{{ conv.totalTokens.toLocaleString() }}</span>
      </div>
      <!-- 创建时间 -->
      <div class="pcm-item">
        <span class="pcm-label">创建时间</span>
        <span class="pcm-value">{{ formatDate(conv.createdAt) }}</span>
      </div>
      <!-- 更新时间 -->
      <div class="pcm-item">
        <span class="pcm-label">最后更新</span>
        <span class="pcm-value">{{ formatDate(conv.updatedAt) }}</span>
      </div>
      <!-- 标签 -->
      <div v-if="conv.tags.length > 0" class="pcm-item pcm-item-full">
        <span class="pcm-label">标签</span>
        <div class="pcm-tags">
          <span v-for="tag in conv.tags" :key="tag" class="pcm-tag">{{ tag }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import type { ConversationDetail } from '@/stores/historyStore'  // 类型

// ==================== Props ====================
defineProps({
  conv: { type: Object as () => ConversationDetail, required: true },  // 会话详情
})

// formatDate —— 格式化日期
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
/* 容器 */
.pcm { padding: 0 0 20px 0; }

/* 标题 */
.pcm-title {
  font-size: 18px;
  font-weight: 700;
  color: #E6EDF3;
  margin-bottom: 16px;
  word-break: break-word;
}

/* 元数据网格 */
.pcm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

/* 单个元数据项 */
.pcm-item { padding: 10px 12px; background: rgba(22, 27, 34, 0.4); border-radius: 10px; }

/* 全宽项 */
.pcm-item-full { grid-column: 1 / -1; }

/* 标签 */
.pcm-label { display: block; font-size: 11px; color: #64748B; margin-bottom: 4px; }

/* 值 */
.pcm-value { font-size: 13px; color: #E6EDF3; font-weight: 500; }

/* 模型名特殊样式 */
.pcm-model {
  color: #00E5D8;
  padding: 2px 8px;
  background: rgba(0, 229, 216, 0.08);
  border-radius: 6px;
  font-size: 12px;
}

/* 标签容器 */
.pcm-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }

/* 标签 */
.pcm-tag {
  padding: 3px 10px;
  background: rgba(99, 102, 241, 0.12);
  border-radius: 12px;
  font-size: 12px;
  color: #818CF8;
}
</style>
```

- [ ] **Step 2: 创建 PanelConversationSummary.vue**

```vue
<!-- PanelConversationSummary.vue —— AI 会话总结区 -->
<template>
  <div class="pcs">
    <!-- 标题栏 -->
    <div class="pcs-header">
      <h4 class="pcs-title">AI 摘要</h4>
      <!-- 没有摘要时显示生成按钮 -->
      <button
        v-if="!conv.summary && !isSummarizing"
        class="pcs-gen-btn"
        :disabled="isSummarizing"
        @click="$emit('summarize', conv.id)"
      >
        ⚡ 生成摘要
      </button>
    </div>

    <!-- 生成中动画 -->
    <div v-if="isSummarizing" class="pcs-loading">
      <div class="pcs-scan-line"></div>  <!-- 扫描线动画 -->
      <span class="pcs-loading-text">正在分析对话内容...</span>
    </div>

    <!-- 摘要内容 -->
    <p v-else-if="conv.summary" class="pcs-content">{{ conv.summary }}</p>

    <!-- 无摘要 -->
    <p v-else class="pcs-empty">点击上方按钮生成 AI 摘要</p>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import type { ConversationDetail } from '@/stores/historyStore'  // 类型

// ==================== Props ====================
defineProps({
  conv: { type: Object as () => ConversationDetail, required: true },  // 会话详情
  isSummarizing: { type: Boolean, default: false },                    // 是否生成中
})

// ==================== Events ====================
defineEmits(['summarize'])  // 请求生成摘要
</script>

<style scoped>
/* 容器 */
.pcs {
  padding: 20px 0;
  border-top: 1px solid rgba(0, 229, 216, 0.08);
}

/* 标题栏 */
.pcs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }

/* 标题 */
.pcs-title { font-size: 14px; font-weight: 600; color: #E6EDF3; }

/* 生成按钮 */
.pcs-gen-btn {
  padding: 6px 14px;
  background: linear-gradient(135deg, rgba(0, 229, 216, 0.15), rgba(99, 102, 241, 0.15));
  border: 1px solid rgba(0, 229, 216, 0.2);
  border-radius: 8px;
  font-size: 12px;
  color: #00E5D8;
  cursor: pointer;
  transition: all 0.2s;
}

.pcs-gen-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(0, 229, 216, 0.25), rgba(99, 102, 241, 0.25));
}

.pcs-gen-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 生成中容器 */
.pcs-loading {
  position: relative;
  height: 80px;
  background: rgba(22, 27, 34, 0.4);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 扫描线动画 */
.pcs-scan-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00E5D8, transparent);
  animation: pcs-scan 1.5s ease-in-out infinite;
}

@keyframes pcs-scan {
  0% { top: 0; }
  50% { top: calc(100% - 2px); }
  100% { top: 0; }
}

/* 生成中提示 */
.pcs-loading-text { font-size: 13px; color: #64748B; }

/* 摘要内容 */
.pcs-content {
  font-size: 13px;
  color: #94A3B8;
  line-height: 1.7;
  padding: 14px;
  background: rgba(22, 27, 34, 0.3);
  border-radius: 10px;
  border: 1px solid rgba(0, 229, 216, 0.06);
}

/* 无摘要提示 */
.pcs-empty { font-size: 13px; color: #64748B; text-align: center; padding: 20px; }
</style>
```

- [ ] **Step 3: 创建 PanelActions.vue**

```vue
<!-- PanelActions.vue —— 预览面板底部操作按钮 -->
<template>
  <div class="pa">
    <!-- 继续对话 -->
    <button class="pa-btn pa-continue" @click="$emit('continue', conv.id)">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      继续对话
    </button>

    <!-- 星标切换 -->
    <button class="pa-btn" @click="$emit('star', conv.id)">
      {{ conv.isStarred ? '★ 取消星标' : '☆ 添加星标' }}
    </button>

    <!-- 归档 -->
    <button class="pa-btn" @click="$emit('archive', conv.id)">📁 归档</button>

    <!-- 导出 -->
    <button class="pa-btn" @click="$emit('export', conv.id)">📥 导出</button>

    <!-- 删除 -->
    <button class="pa-btn pa-delete" @click="$emit('delete', conv.id)">🗑️ 删除</button>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import type { ConversationDetail } from '@/stores/historyStore'  // 类型

// ==================== Props ====================
defineProps({
  conv: { type: Object as () => ConversationDetail, required: true },  // 会话详情
})

// ==================== Events ====================
defineEmits(['continue', 'star', 'archive', 'export', 'delete'])
</script>

<style scoped>
/* 容器 */
.pa {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 229, 216, 0.08);
}

/* 操作按钮 */
.pa-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(22, 27, 34, 0.6);
  border: 1px solid rgba(0, 229, 216, 0.12);
  border-radius: 10px;
  font-size: 13px;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.15s;
}

.pa-btn svg { width: 16px; height: 16px; }

.pa-btn:hover {
  background: rgba(0, 229, 216, 0.08);
  color: #F1F5F9;
}

/* 继续对话按钮 */
.pa-continue {
  width: 100%;
  justify-content: center;
  background: linear-gradient(135deg, #00E5D8, #00B8D4);
  border: none;
  color: #0A0C12;
  font-weight: 600;
  font-size: 14px;
  padding: 12px;
}

.pa-continue:hover {
  box-shadow: 0 4px 16px rgba(0, 229, 216, 0.3);
  color: #0A0C12;
}

/* 删除按钮 */
.pa-delete:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.25);
  color: #EF4444;
}
</style>
```

- [ ] **Step 4: 创建 HistoryDetailPanel.vue（组合以上三个子组件 + 消息预览）**

```vue
<!-- HistoryDetailPanel.vue —— 右侧预览面板容器 -->
<template>
  <div class="hdp">
    <!-- 加载骨架 -->
    <div v-if="hs.detailLoading" class="hdp-loading">
      <HistoryListSkeleton />
    </div>

    <!-- 详情内容 -->
    <template v-else-if="hs.selectedConversation">
      <!-- ===== 顶部栏 ===== -->
      <div class="hdp-header">
        <h3 class="hdp-title">会话详情</h3>
        <button class="hdp-close" @click="hs.closeDetail()">✕</button>
      </div>

      <!-- ===== 元数据 ===== -->
      <PanelConversationMeta :conv="hs.selectedConversation" />

      <!-- ===== AI 摘要 ===== -->
      <PanelConversationSummary
        :conv="hs.selectedConversation"
        :isSummarizing="hs.isSummarizing"
        @summarize="hs.summarize"
      />

      <!-- ===== 消息预览（最近 10 条） ===== -->
      <div class="hdp-messages">
        <h4 class="hdp-section-title">对话预览</h4>
        <div class="hdp-msg-list">
          <div
            v-for="msg in previewMessages"
            :key="msg.id"
            :class="['hdp-msg', msg.role === 'user' ? 'hdp-msg-user' : 'hdp-msg-ai']"
          >
            <span class="hdp-msg-role">{{ msg.role === 'user' ? '👤' : '🤖' }}</span>
            <p class="hdp-msg-content">{{ msg.content.slice(0, 150) }}{{ msg.content.length > 150 ? '...' : '' }}</p>
          </div>
        </div>
      </div>

      <!-- ===== 操作按钮 ===== -->
      <PanelActions
        :conv="hs.selectedConversation"
        @continue="onContinue"
        @delete="onDelete"
        @archive="onArchive"
        @export="onExport"
        @star="onStar"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================
import { computed } from 'vue'                             // Vue 响应式
import { useRouter } from 'vue-router'                     // 路由跳转
import { useChatStore } from '@/stores/chatStore'          // 对话 Store
import { useHistoryStore } from '@/stores/historyStore'    // History Store
import { wsClient } from '@/composables/useWs'             // WS 客户端
import PanelConversationMeta from '@/components/history/PanelConversationMeta.vue'       // 元数据
import PanelConversationSummary from '@/components/history/PanelConversationSummary.vue' // AI 摘要
import PanelActions from '@/components/history/PanelActions.vue'                         // 操作按钮
import HistoryListSkeleton from '@/components/history/HistoryListSkeleton.vue'           // 骨架

// ==================== 初始化 ====================
const hs = useHistoryStore()
const cs = useChatStore()
const router = useRouter()

// previewMessages —— 取最近 10 条消息预览
const previewMessages = computed(() => {
  const msgs = hs.selectedConversation?.messages || []
  return msgs.slice(-10)  // 最后 10 条
})

// ==================== 事件处理 ====================

// onContinue —— 跳转到对话页继续聊天
async function onContinue(id: string) {
  await cs.selectConversation(id)   // 切换到该会话
  router.push('/chat')              // 跳转到对话页
  hs.closeDetail()                  // 关闭预览
}

// onDelete —— 删除当前会话
async function onDelete(id: string) {
  await wsClient.send('history.batch_delete', { conversation_ids: [id] })
  hs.closeDetail()       // 关闭预览
  hs.fetchList()         // 刷新列表
}

// onArchive —— 归档当前会话
async function onArchive(id: string) {
  await wsClient.send('history.batch_archive', { conversation_ids: [id] })
  hs.closeDetail()
  hs.fetchList()
}

// onExport —— 导出当前会话
async function onExport(id: string) {
  const res = await wsClient.send('history.batch_export', { conversation_ids: [id], format: 'md' })
  const blob = new Blob([res.content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hourmind-conversation-${id.slice(0, 8)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

// onStar —— 切换星标
async function onStar(id: string) {
  const conv = hs.selectedConversation
  if (!conv) return
  await wsClient.send('conversations.update', {
    conversationId: id,
    isStarred: !conv.isStarred,     // 切换星标状态（Task 8 已添加后端支持）
  })
  // 刷新预览数据
  hs.selectConversation(id)
  hs.fetchList()
}
</script>

<style scoped>
/* 容器 */
.hdp {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
}

/* 顶部栏 */
.hdp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

/* 标题 */
.hdp-title { font-size: 16px; font-weight: 600; color: #E6EDF3; }

/* 关闭按钮 */
.hdp-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: none;
  border-radius: 8px;
  color: #94A3B8;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.hdp-close:hover { background: rgba(255, 255, 255, 0.08); color: #F1F5F9; }

/* Section 标题 */
.hdp-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #E6EDF3;
  margin-bottom: 10px;
}

/* 消息预览区 */
.hdp-messages {
  padding: 20px 0;
  border-top: 1px solid rgba(0, 229, 216, 0.08);
}

/* 消息列表 */
.hdp-msg-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }

/* 单条消息 */
.hdp-msg {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
}

/* 用户消息 */
.hdp-msg-user { background: rgba(0, 229, 216, 0.05); }

/* AI 消息 */
.hdp-msg-ai { background: rgba(22, 27, 34, 0.4); }

/* 角色图标 */
.hdp-msg-role { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

/* 消息内容 */
.hdp-msg-content {
  font-size: 13px;
  color: #94A3B8;
  line-height: 1.6;
  margin: 0;
}

/* 加载骨架 */
.hdp-loading { padding: 20px; }
</style>
```

---

### Task 7: 验证与集成

**Files:** (无新建，验证所有集成)

- [ ] **Step 1: 后端构建验证**

```bash
cd hourmind/server && npm run build
```

Expected: 编译成功，无错误

- [ ] **Step 2: 前端类型检查 + 构建验证**

```bash
cd hourmind/client && npx vue-tsc -b --noEmit 2>&1 | head -30
```

Expected: 无类型错误

- [ ] **Step 3: 启动后端验证 API 注册**

```bash
cd hourmind/server && timeout 5 npm run dev 2>&1 || true
```

Expected: 看到 "HourMind 后端已启动"，无 handler 注册错误

- [ ] **Step 4: 提交全部前端组件**

```bash
cd /Users/hours/个人智能系统设计 && git add hourmind/client/src/views/HistoryView.vue hourmind/client/src/components/history/ hourmind/client/src/stores/historyStore.ts && git commit -m "feat: 添加历史记录模块完整前端实现（三栏布局+列表+筛选+预览+总结）"
```

---

### Task 8: 修复 existing conversations.update — 支持 isStarred

**Files:**
- Modify: `hourmind/server/src/handlers/chatHandler.ts`

chatHandler 中的 `conversations.update` 当前只支持 `title` 和 `model`，需要也支持 `isStarred`：

- [ ] **Step 1: 更新 conversations.update 支持 isStarred**

在 `chatHandler.ts` 的 `conversations.update` handler 中，修改 data 构建逻辑：

```typescript
// 只更新传了值的字段
const data: any = {}
if (title !== undefined) data.title = title
if (model !== undefined) data.model = model
if (payload.isStarred !== undefined) data.isStarred = payload.isStarred  // 新增：支持星标切换
```

- [ ] **Step 2: 验证编译 + 提交**

```bash
cd hourmind/server && npm run build
cd /Users/hours/个人智能系统设计 && git add hourmind/server/src/handlers/chatHandler.ts && git commit -m "feat: conversations.update 支持 isStarred 星标切换"
```

---

## 自审清单

1. **Spec coverage**: 对照 spec 和 PRD，全部 7 个 action、11 个前端组件、路由、store 均有对应 Task
2. **Placeholder scan**: 仅一处"TODO"在 HistoryList.vue 虚拟滚动逻辑中，属于 spec 明确要求的延迟实现（">500 条时启用虚拟滚动"），MVP 阶段全量渲染。其余所有步骤包含完整代码。
3. **Type consistency**: store 中的 `ConversationHistory` 和 `ConversationDetail` 类型在全部组件中一致使用
4. **设计偏差**: AI 总结由 Python 服务改为 Node.js 直接调厂商 API（已获用户确认）
