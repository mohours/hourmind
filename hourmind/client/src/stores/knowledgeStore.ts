// ============================================================
// knowledgeStore.ts —— 个人知识库状态管理（Pinia Store）
//
// 管理知识文档列表、搜索、卡片管理。
// 当前 MVP 阶段仅支持手动创建笔记，文件上传/解析后续扩展。
// ============================================================

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wsClient } from '@/composables/useWs'

// 知识文档类型
export interface KnowledgeDocument {
  id: string; title: string; content: string
  summary: string | null; fileType: string; fileSize: number | null
  isIndexed: boolean; tags: string; folder: string | null
  createdAt: string; updatedAt: string
  cardCount?: number  // 关联的卡片数量（列表返回）
  cards?: KnowledgeCard[]  // 关联的卡片（详情返回）
}
// 知识卡片类型
export interface KnowledgeCard {
  id: string; documentId: string; title: string
  content: string; tags: string; isPinned: boolean
  createdAt: string; updatedAt: string
}

export const useKnowledgeStore = defineStore('knowledge', () => {
  // ——— 状态 ———
  const documents = ref<KnowledgeDocument[]>([])
  const loading = ref(false)
  const search = ref('')                // 搜索关键词
  const folderFilter = ref('all')       // 文件夹筛选
  const typeFilter = ref('all')         // 文件类型筛选
  const selectedDocId = ref<string | null>(null)  // 当前选中的文档
  const selectedDoc = ref<KnowledgeDocument | null>(null)  // 文档详情
  const detailLoading = ref(false)
  const totalCount = ref(0)
  const totalPages = ref(0)
  const page = ref(1)
  const showCreateDialog = ref(false)

  // ——— 操作 ———

  // 获取文档列表
  async function fetchList() {
    loading.value = true
    try {
      const result = await wsClient.send<{
        documents: KnowledgeDocument[]
        total: number; page: number; totalPages: number
      }>('knowledge.list', {
        search: search.value || undefined,
        folder: folderFilter.value !== 'all' ? folderFilter.value : undefined,
        fileType: typeFilter.value !== 'all' ? typeFilter.value : undefined,
        page: page.value,
      })
      documents.value = result.documents
      totalCount.value = result.total
      totalPages.value = result.totalPages
    } finally {
      loading.value = false
    }
  }

  // 获取文档详情
  async function fetchDetail(documentId: string) {
    detailLoading.value = true
    selectedDocId.value = documentId
    try {
      selectedDoc.value = await wsClient.send<KnowledgeDocument>('knowledge.get', { documentId })
    } finally {
      detailLoading.value = false
    }
  }

  // 创建笔记
  async function createNote(data: { title: string; content: string; tags?: string[]; folder?: string }) {
    const doc = await wsClient.send<KnowledgeDocument>('knowledge.create_note', data)
    documents.value.unshift(doc)
    return doc
  }

  // 更新文档
  async function updateDoc(documentId: string, data: Record<string, any>) {
    const updated = await wsClient.send<KnowledgeDocument>('knowledge.update', { documentId, ...data })
    const idx = documents.value.findIndex(d => d.id === documentId)
    if (idx >= 0) documents.value[idx] = { ...documents.value[idx], ...updated }
    if (selectedDoc.value?.id === documentId) selectedDoc.value = { ...selectedDoc.value, ...updated }
  }

  // 删除文档
  async function deleteDoc(documentId: string) {
    await wsClient.send('knowledge.delete', { documentId })
    documents.value = documents.value.filter(d => d.id !== documentId)
    if (selectedDocId.value === documentId) {
      selectedDocId.value = null
      selectedDoc.value = null
    }
  }

  // 全文搜索
  async function fullSearch(query: string): Promise<any[]> {
    return wsClient.send('knowledge.search', { query })
  }

  // 创建卡片
  async function createCard(documentId: string, data: { title: string; content: string; tags?: string[] }) {
    const card = await wsClient.send<KnowledgeCard>('knowledge.cards.create', { documentId, ...data })
    if (selectedDoc.value?.id === documentId && selectedDoc.value.cards) {
      selectedDoc.value.cards.push(card)
    }
    return card
  }

  // 删除卡片
  async function deleteCard(cardId: string) {
    await wsClient.send('knowledge.cards.delete', { cardId })
    if (selectedDoc.value?.cards) {
      selectedDoc.value.cards = selectedDoc.value.cards.filter(c => c.id !== cardId)
    }
  }

  return {
    documents, loading, search, folderFilter, typeFilter,
    selectedDocId, selectedDoc, detailLoading, totalCount, totalPages, page,
    showCreateDialog,
    fetchList, fetchDetail, createNote, updateDoc, deleteDoc,
    fullSearch, createCard, deleteCard,
  }
})
