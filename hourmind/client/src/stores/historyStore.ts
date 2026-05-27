// historyStore.ts —— 历史对话管理状态
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '@/composables/useWs'

// 历史对话列表项类型（匹配后端返回格式）
export interface ConversationHistory {
  id: string; title: string; model: string; status: string
  isStarred: boolean; isPinned: boolean
  totalTokens: number; messageCount: number
  summary: string | null; preview: string
  tags: string[]; createdAt: string; updatedAt: string
}

export const useHistoryStore = defineStore('history', () => {
  const conversations = ref<ConversationHistory[]>([]) // 当前页对话列表
  const loading = ref(false) // 列表加载状态
  const totalCount = ref(0) // 总记录数
  const totalPages = ref(0) // 总页数

  // 筛选与排序
  const search = ref('') // 搜索关键词
  const statusFilter = ref('all') // 状态筛选：all/active/archived/deleted
  const modelFilter = ref('') // 模型筛选
  const sort = ref('updated_desc') // 排序方式
  const page = ref(1) // 当前页码

  // 批量选择
  const selectedIds = ref<Set<string>>(new Set()) // 选中的对话 ID 集合
  const showBatchBar = computed(() => selectedIds.value.size > 0) // 是否显示批量操作栏

  // 摘要
  const isSummarizing = ref(false) // 是否正在生成摘要
  const summarizingId = ref<string | null>(null) // 正在生成摘要的对话 ID

  // 获取历史对话列表（参数名匹配后端 snake_case）
  async function fetchList() {
    loading.value = true
    try {
      const result = await wsClient.send<{
        conversations: ConversationHistory[] // 后端返回 conversations
        total: number
        totalPages: number
      }>('history.list', {
        search: search.value || undefined, // 空字符串传 undefined
        status: statusFilter.value,
        model: modelFilter.value || undefined,
        date_from: undefined, // 暂不支持日期筛选
        date_to: undefined,
        sort: sort.value,
        page: page.value,
      })
      // 后端返回 conversations（不是 items）
      conversations.value = result.conversations || []
      totalCount.value = result.total || 0
      totalPages.value = result.totalPages || 0
    } finally {
      loading.value = false
    }
  }

  // 批量删除（后端期望 conversation_ids，snake_case）
  async function batchDelete() {
    const conversation_ids = Array.from(selectedIds.value) // 转 snake_case
    if (conversation_ids.length === 0) return
    await wsClient.send('history.batch_delete', { conversation_ids })
    selectedIds.value = new Set()
    await fetchList() // 刷新列表
  }

  // 批量归档
  async function batchArchive() {
    const conversation_ids = Array.from(selectedIds.value)
    if (conversation_ids.length === 0) return
    await wsClient.send('history.batch_archive', { conversation_ids })
    selectedIds.value = new Set()
    await fetchList()
  }

  // 批量导出
  async function batchExport(format: 'md' | 'json') {
    const conversation_ids = Array.from(selectedIds.value)
    if (conversation_ids.length === 0) return
    const result = await wsClient.send<{ content: string; format: string }>(
      'history.batch_export', { conversation_ids, format }
    )
    // 触发浏览器下载
    const mimeMap: Record<string, string> = { json: 'application/json', md: 'text/markdown' }
    const extMap: Record<string, string> = { json: 'json', md: 'md' }
    const blob = new Blob([result.content], { type: mimeMap[format] || 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hourmind-export-${Date.now()}.${extMap[format] || format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 恢复已删除对话
  async function recoverConversation(id: string) {
    await wsClient.send('history.recover', { conversation_id: id }) // snake_case
    await fetchList()
  }

  // AI 生成对话摘要
  async function summarize(id: string) {
    isSummarizing.value = true
    summarizingId.value = id
    try {
      const result = await wsClient.send<{ summary: string }>(
        'history.summarize', { conversation_id: id }
      )
      // 更新列表中对应项的 summary
      const item = conversations.value.find(c => c.id === id)
      if (item) item.summary = result.summary
    } finally {
      isSummarizing.value = false
      summarizingId.value = null
    }
  }

  // 切换单个对话的选中状态
  function toggleSelect(id: string) {
    const set = selectedIds.value
    if (set.has(id)) set.delete(id)
    else set.add(id)
    selectedIds.value = new Set(set) // Set 变更需重新赋值触发响应式
  }

  // 全选/取消全选
  function selectAll() {
    selectedIds.value = new Set(conversations.value.map(c => c.id))
  }
  function clearSelection() {
    selectedIds.value = new Set()
  }

  // 筛选条件变更 → 重置页码 + 刷新
  function setFilter(key: string, value: any) {
    switch (key) {
      case 'search': search.value = value; break
      case 'status': statusFilter.value = value; break
      case 'model': modelFilter.value = value; break
      case 'sort': sort.value = value; break
    }
    page.value = 1
    fetchList()
  }

  // 初始化：加载历史列表
  async function init() {
    await fetchList()
  }

  return {
    conversations, loading, totalCount, totalPages,
    search, statusFilter, modelFilter, sort, page,
    selectedIds, showBatchBar,
    isSummarizing, summarizingId,
    fetchList, batchDelete, batchArchive, batchExport,
    recoverConversation, summarize,
    toggleSelect, selectAll, clearSelection,
    setFilter, init,
  }
})
