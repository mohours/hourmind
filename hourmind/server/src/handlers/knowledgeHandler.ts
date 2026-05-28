// ============================================================
// knowledgeHandler.ts —— 个人知识库处理函数
// 负责 knowledge.* 和 knowledge.cards.* 系列 action
//
// 知识库 = 文档（KnowledgeDocument）+ 知识卡片（KnowledgeCard）
//   文档：用户上传的文件或手动创建的笔记
//   卡片：从文档中提取的精华片段，可独立查看
//
// action 清单：
//   knowledge.list         — 文档列表（支持搜索/标签/文件夹/类型筛选）
//   knowledge.get          — 文档详情（含内容 + 关联卡片）
//   knowledge.create_note  — 手动创建笔记
//   knowledge.update       — 编辑文档（标题/内容/标签/文件夹）
//   knowledge.delete       — 删除文档（含关联卡片）
//   knowledge.search       — 全文关键词搜索
//   knowledge.cards.list   — 卡片列表
//   knowledge.cards.create — 创建卡片
//   knowledge.cards.delete — 删除卡片
// ============================================================

import { prisma } from '../db'
import { registerRoute } from '../wsRouter'
import type { WsResponse } from '../wsRouter'

// ==================== knowledge.list ====================
// 获取文档列表
// payload: { search?, tag?, folder?, fileType?, page? }
registerRoute('knowledge.list', async (payload): Promise<WsResponse> => {
  try {
    const { search, tag, folder, fileType, page = 1 } = payload || {}
    const pageSize = 30
    const skip = (page - 1) * pageSize

    const where: any = {}

    // 标题或内容包含搜索词（SQLite LIKE 关键词匹配）
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ]
    }

    // 标签筛选：存的是 JSON 数组字符串，用 contains 模糊匹配
    if (tag) where.tags = { contains: tag }

    // 文件夹筛选
    if (folder) where.folder = folder

    // 文件类型筛选
    if (fileType && fileType !== 'all') where.fileType = fileType

    const [docs, total] = await Promise.all([
      prisma.knowledgeDocument.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: { cards: { select: { id: true } } }, // 只取卡片数量
      }),
      prisma.knowledgeDocument.count({ where }),
    ])

    return {
      success: true,
      data: {
        documents: docs.map(d => ({
          ...d,
          cardCount: d.cards.length,
          cards: undefined, // 列表里不返回完整卡片
          content: d.content.slice(0, 200), // 只返回前 200 字符作为预览
        })),
        total,
        page,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== knowledge.get ====================
// 获取文档详情（含完整内容 + 关联卡片）
// payload: { documentId }
registerRoute('knowledge.get', async (payload): Promise<WsResponse> => {
  try {
    const { documentId } = payload

    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      include: {
        cards: { orderBy: { isPinned: 'desc' } },
      },
    })

    if (!doc) return { success: false, error: { code: 'DOC_NOT_FOUND', message: '文档不存在' } }

    return { success: true, data: doc }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== knowledge.create_note ====================
// 手动创建笔记（不涉及文件上传）
// payload: { title, content, tags?, folder? }
registerRoute('knowledge.create_note', async (payload): Promise<WsResponse> => {
  try {
    const { title, content, tags, folder } = payload

    if (!title || !title.trim()) {
      return { success: false, error: { code: 'MISSING_FIELDS', message: '标题不能为空' } }
    }

    const doc = await prisma.knowledgeDocument.create({
      data: {
        title: title.trim(),
        content: content || '',
        fileType: 'manual',
        tags: JSON.stringify(tags || []),
        folder: folder || null,
        isIndexed: true,
      },
    })

    return { success: true, data: doc }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== knowledge.update ====================
// 编辑文档
// payload: { documentId, title?, content?, tags?, folder? }
registerRoute('knowledge.update', async (payload): Promise<WsResponse> => {
  try {
    const { documentId, title, content, tags, folder } = payload

    const data: any = {}
    if (title !== undefined) data.title = title.trim()
    if (content !== undefined) data.content = content
    if (tags !== undefined) data.tags = JSON.stringify(tags)
    if (folder !== undefined) data.folder = folder

    const doc = await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data,
    })

    return { success: true, data: doc }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== knowledge.delete ====================
// 删除文档（及关联的所有卡片）
// payload: { documentId }
registerRoute('knowledge.delete', async (payload): Promise<WsResponse> => {
  try {
    const { documentId } = payload

    // 先删关联的卡片
    await prisma.knowledgeCard.deleteMany({ where: { documentId } })
    // 再删文档
    await prisma.knowledgeDocument.delete({ where: { id: documentId } })

    return { success: true, data: { message: '已删除' } }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== knowledge.search ====================
// 全文关键词搜索（在所有文档的标题和内容中搜索）
// payload: { query }
registerRoute('knowledge.search', async (payload): Promise<WsResponse> => {
  try {
    const { query } = payload
    if (!query || !query.trim()) {
      return { success: true, data: [] }
    }

    // SQLite LIKE 全文搜索（后续迁移到 PostgreSQL 可用 pgvector 语义搜索）
    const docs = await prisma.knowledgeDocument.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { content: { contains: query } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })

    return {
      success: true,
      data: docs.map(d => ({
        id: d.id,
        title: d.title,
        // 找到关键词在内容中的位置，返回上下文
        snippet: extractSnippet(d.content, query),
        fileType: d.fileType,
        updatedAt: d.updatedAt,
      })),
    }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== knowledge.cards.list ====================
// 获取知识卡片列表
// payload: { documentId? } — 可选，不传则返回所有卡片
registerRoute('knowledge.cards.list', async (payload): Promise<WsResponse> => {
  try {
    const { documentId } = payload || {}

    const where: any = {}
    if (documentId) where.documentId = documentId

    const cards = await prisma.knowledgeCard.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    })

    return { success: true, data: cards }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== knowledge.cards.create ====================
// 创建知识卡片
// payload: { documentId, title, content, tags? }
registerRoute('knowledge.cards.create', async (payload): Promise<WsResponse> => {
  try {
    const { documentId, title, content, tags } = payload

    if (!title || !title.trim()) {
      return { success: false, error: { code: 'MISSING_FIELDS', message: '卡片标题不能为空' } }
    }

    const card = await prisma.knowledgeCard.create({
      data: {
        documentId,
        title: title.trim(),
        content: content || '',
        tags: JSON.stringify(tags || []),
      },
    })

    return { success: true, data: card }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== knowledge.cards.delete ====================
// 删除知识卡片
// payload: { cardId }
registerRoute('knowledge.cards.delete', async (payload): Promise<WsResponse> => {
  try {
    const { cardId } = payload
    await prisma.knowledgeCard.delete({ where: { id: cardId } })
    return { success: true, data: { message: '已删除' } }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== 工具函数 ====================
// 提取关键词周围的文本片段（用于搜索结果预览）
function extractSnippet(content: string, query: string, contextLen = 80): string {
  if (!content || !query) return content?.slice(0, 200) || ''

  const idx = content.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, 200)

  const start = Math.max(0, idx - contextLen)
  const end = Math.min(content.length, idx + query.length + contextLen)
  let snippet = content.slice(start, end)

  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet = snippet + '...'

  return snippet
}
