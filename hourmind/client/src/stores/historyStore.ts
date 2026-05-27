// historyStore.ts —— 历史对话管理状态
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '@/composables/useWs'

// 历史对话列表项类型
export interface ConversationHistory {
  id: string; title: string; model: string; status: string
  isStarred: boolean; isPinned: boolean
  totalTokens: number; messageCount: number
  summary: string | null; preview: string
  tags: string[]; createdAt: string; updatedAt: string
}

// 历史对话详情类型（含消息列表）
export interface ConversationDetail {
  id: string; title: string; model: string; status: string
  isStarred: boolean; isPinned: boolean
  totalTokens: number; messageCount: number
  summary: string | null; tags: string[]
  createdAt: string; updatedAt: string
  messages: { id: string; role: string; content: string; model?: string; createdAt: string }[]
}

export const useHistoryStore = defineStore('history', () => {
  // —— 列表数据 ——
  const conversations = ref<ConversationHistory[]>([])            // 当前页对话列表
  const loading = ref(false)                                      // 列表加载状态

  // —— 分页 ——
  const totalCount = ref(0)                                       // 总记录数
  const totalPages = ref(0)                                       // 总页数

  // —— 筛选与排序 ——
  const search = ref('')                                          // 搜索关键词
  const statusFilter = ref('all')                                 // 状态筛选：all/active/archived/deleted
  const modelFilter = ref('')                                     // 模型筛选
  const tagFilter = ref('')                                       // 标签筛选
  const dateRange = ref<{ from: string | null; to: string | null }>({ from: null, to: null })  // 日期范围
  const sort = ref('updated_desc')                                // 排序方式
  const page = ref(1)                                             // 当前页码

  // —— 批量选择 ——
  const selectedIds = ref<Set<string>>(new Set())                 // 选中的对话 ID 集合
  const showBatchBar = computed(() => selectedIds.value.size > 0) // 是否显示批量操作栏

  // —— 详情面板 ——
  const selectedConversation = ref<ConversationDetail | null>(null)  // 当前查看的对话详情
  const detailLoading = ref(false)                                   // 详情加载状态

  // —— 摘要 ——
  const isSummarizing = ref(false)                                // 是否正在生成摘要

  // —— 标签云 ——
  const allTags = ref<string[]>([])                               // 当前列表所有标签去重汇总

  // —— 获取筛选条件对象（用于发送到后端） ——
  function getFilters() {
    return {
      search: search.value,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      model: modelFilter.value || undefined,
      tag: tagFilter.value || undefined,
      dateFrom: dateRange.value.from || undefined,
      dateTo: dateRange.value.to || undefined,
      sort: sort.value,
      page: page.value,
      pageSize: 20,
    }
  }

  // 获取历史对话列表
  async function fetchList() {
    loading.value = true
    try {
      // 调用后端 history.list 接口，传入当前筛选条件
      const result = await wsClient.send<{
        items: ConversationHistory[]
        total: number
        totalPages: number
        tags: string[]
      }>('history.list', getFilters())
      conversations.value = result.items || []
      totalCount.value = result.total || 0
      totalPages.value = result.totalPages || 0
      allTags.value = result.tags || []
    } finally {
      loading.value = false
    }
  }

  // 选中某条对话并加载其消息详情
  async function selectConversation(id: string) {
    detailLoading.value = true
    try {
      // 调用后端 messages.list 接口获取对话消息
      const result = await wsClient.send<{
        conversation: ConversationDetail
        messages: ConversationDetail['messages']
      }>('messages.list', { conversationId: id })
      selectedConversation.value = {
        ...result.conversation,
        messages: result.messages || [],
      }
    } finally {
      detailLoading.value = false
    }
  }

  // 关闭详情面板
  function closeDetail() {
    selectedConversation.value = null
  }

  // 批量删除选中的对话
  async function batchDelete() {
    const ids = Array.from(selectedIds.value)
    if (ids.length === 0) return
    await wsClient.send('history.batch_delete', { ids })
    // 清空已选并刷新列表
    selectedIds.value = new Set()
    await fetchList()
  }

  // 批量归档选中的对话
  async function batchArchive() {
    const ids = Array.from(selectedIds.value)
    if (ids.length === 0) return
    await wsClient.send('history.batch_archive', { ids })
    selectedIds.value = new Set()
    await fetchList()
  }

  // 批量添加标签到选中的对话
  async function batchTag(tags: string[]) {
    const ids = Array.from(selectedIds.value)
    if (ids.length === 0) return
    await wsClient.send('history.batch_tag', { ids, tags })
    await fetchList()
  }

  // 批量导出选中的对话为指定格式
  async function batchExport(format: 'json' | 'markdown' | 'txt') {
    const ids = Array.from(selectedIds.value)
    if (ids.length === 0) return
    // 调用后端导出接口，获取文件内容
    const result = await wsClient.send<{ content: string; filename: string }>('history.batch_export', { ids, format })
    // 根据内容类型决定 Blob 类型
    const mimeMap: Record<string, string> = {
      json: 'application/json',
      markdown: 'text/markdown',
      txt: 'text/plain',
    }
    const mime = mimeMap[format] || 'text/plain'
    const blob = new Blob([result.content], { type: mime })
    // 创建临时下载链接并触发浏览器下载
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename || `history-export-${Date.now()}.${format}`
    document.body.appendChild(a)
    a.click()
    // 清理 DOM 和对象 URL
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 从回收站恢复指定对话
  async function recoverConversation(id: string) {
    await wsClient.send('history.recover', { conversationId: id })
    await fetchList()
  }

  // 为指定对话生成 AI 摘要
  async function summarize(id: string) {
    isSummarizing.value = true
    try {
      // 调用后端 history.summarize 接口生成摘要
      const result = await wsClient.send<{ summary: string }>('history.summarize', { conversationId: id })
      // 更新详情面板中的摘要
      if (selectedConversation.value && selectedConversation.value.id === id) {
        selectedConversation.value.summary = result.summary
      }
      // 同步更新列表项中的摘要
      const item = conversations.value.find(c => c.id === id)
      if (item) {
        item.summary = result.summary
      }
    } finally {
      isSummarizing.value = false
    }
  }

  // 切换单个对话的选中状态
  function toggleSelect(id: string) {
    const set = selectedIds.value
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    // 触发响应式更新（Set 的变更需要重新赋值才能被 Vue 检测到）
    selectedIds.value = new Set(set)
  }

  // 全选当前列表所有对话
  function selectAll() {
    selectedIds.value = new Set(conversations.value.map(c => c.id))
  }

  // 清空所有选中
  function clearSelection() {
    selectedIds.value = new Set()
  }

  // 更新单个筛选条件，重置页码并重新加载列表
  function setFilter(key: string, value: any) {
    // 根据 key 更新对应的筛选状态
    switch (key) {
      case 'search': search.value = value; break
      case 'status': statusFilter.value = value; break
      case 'model': modelFilter.value = value; break
      case 'tag': tagFilter.value = value; break
      case 'sort': sort.value = value; break
    }
    page.value = 1                      // 重置到第一页
    closeDetail()                       // 关闭详情面板
    fetchList()                         // 刷新列表
  }

  // 设置日期范围筛选，触发刷新
  function setDateRange(from: string | null, to: string | null) {
    dateRange.value = { from, to }
    page.value = 1
    closeDetail()
    fetchList()
  }

  // 初始化：加载历史列表
  async function init() {
    await fetchList()
  }

  return {
    // 状态
    conversations, loading,
    totalCount, totalPages,
    search, statusFilter, modelFilter, tagFilter, dateRange, sort, page,
    selectedIds, showBatchBar,
    selectedConversation, detailLoading,
    isSummarizing, allTags,
    // 操作
    fetchList, selectConversation, closeDetail,
    batchDelete, batchArchive, batchTag, batchExport,
    recoverConversation, summarize,
    toggleSelect, selectAll, clearSelection,
    setFilter, setDateRange, init,
  }
})
