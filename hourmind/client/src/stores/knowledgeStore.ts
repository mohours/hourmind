// client/src/stores/knowledgeStore.ts
// 知识库状态管理 —— 条目 CRUD、类型筛选、搜索
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/appStore'

// 知识库条目接口
export interface KnowledgeEntry {
  id: string            // 条目 ID
  title: string         // 标题
  content: string       // 内容
  type: string          // 类型: note / article / reference / snippet
  tags: string          // 标签（逗号分隔）
  created_at: string    // 创建时间
  updated_at: string    // 更新时间
}

export const useKnowledgeStore = defineStore('knowledge', () => {
  // 条目列表
  const entries = ref<KnowledgeEntry[]>([])
  // 加载状态
  const loading = ref(false)

  // 获取认证 token
  function token() { return useAppStore().token }

  /** 获取知识库条目列表 */
  async function fetchEntries(params?: { type?: string; query?: string }) {
    loading.value = true
    try {
      // 构建查询参数
      const queryParts: string[] = []
      if (params?.type) queryParts.push(`type=${encodeURIComponent(params.type)}`)  // 类型筛选
      if (params?.query) queryParts.push(`q=${encodeURIComponent(params.query)}`)    // 搜索关键词
      const queryStr = queryParts.length > 0 ? '?' + queryParts.join('&') : ''
      const data = await api('GET', '/knowledge' + queryStr, undefined, token())
      if (Array.isArray(data)) entries.value = data
    } catch {
      console.warn('获取知识库条目失败')
    } finally {
      loading.value = false
    }
  }

  /** 创建新条目 */
  async function createEntry(title: string, content: string, type?: string, tags?: string) {
    const body: Record<string, any> = { title, content }  // 必填字段
    if (type) body.type = type      // 类型（可选）
    if (tags) body.tags = tags      // 标签（可选）
    const data = await api('POST', '/knowledge', body, token())
    if (data.id) await fetchEntries()  // 创建成功后刷新
    return data
  }

  /** 更新条目 */
  async function updateEntry(entryId: string, fields: Record<string, any>) {
    const data = await api('PUT', `/knowledge/${entryId}`, fields, token())
    if (data.id) await fetchEntries()  // 更新成功后刷新
    return data
  }

  /** 删除条目 */
  async function deleteEntry(entryId: string) {
    await api('DELETE', `/knowledge/${entryId}`, undefined, token())
    await fetchEntries()  // 删除后刷新
  }

  return {
    entries,
    loading,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
  }
})
