// ============================================================
// historyHandler.ts —— 历史记录管理处理器
// 负责 history.* 系列 action —— 对话历史的高级管理功能
//
// 功能清单：
//   history.list          — 分页查询对话历史（支持搜索、筛选、排序）
//   history.batch_delete  — 批量软删除对话
//   history.batch_archive — 批量归档对话
//   history.batch_tag     — 批量给对话打标签
//   history.batch_export  — 批量导出对话（支持 JSON/Markdown 格式）
//   history.recover       — 恢复已删除的对话
//   history.summarize     — AI 生成对话摘要
// ============================================================

// 数据库连接（Prisma Client）
import { prisma } from '../db'
// 路由注册函数和响应类型
import { registerRoute } from '../wsRouter'
import type { WsResponse } from '../wsRouter'
// AI 服务：调用厂商 API 生成摘要
import { summarizeChat } from '../services/aiService'

// ==================== history.list ====================
// 分页查询对话历史，支持多种筛选条件和排序方式
// payload: {
//   search?,      // 标题搜索关键词
//   status?,      // 状态筛选：'all'|'starred'|'archived'|'deleted'，默认'all'
//   model?,       // 模型筛选：精确匹配
//   tag?,         // 标签筛选：包含指定标签
//   date_from?,   // 开始日期（ISO 字符串）
//   date_to?,     // 结束日期（ISO 字符串）
//   page=1,       // 页码，从1开始
//   sort='updated_desc'  // 排序：updated_desc|created_desc|tokens_desc
// }
registerRoute('history.list', async (payload): Promise<WsResponse> => {
  try {
    // 解构请求参数，设置默认值
    const {
      search,           // 搜索关键词
      status = 'all',   // 状态筛选，默认'all'（排除已删除）
      model,            // 模型筛选
      tag,              // 标签筛选
      date_from,        // 日期范围开始
      date_to,          // 日期范围结束
      page = 1,         // 页码，默认第1页
      sort = 'updated_desc',  // 排序方式，默认按更新时间倒序
    } = payload || {}

    // 每页条数固定为30
    const pageSize = 30
    // 计算跳过条数：(页码-1) * 每页条数
    const skip = (page - 1) * pageSize

    // 构建 Prisma where 条件对象
    const where: any = {}

    // 状态筛选逻辑
    if (status === 'all') {
      // 'all' 排除已删除的
      where.status = { not: 'deleted' }
    } else if (status === 'starred') {
      // 'starred' 只看收藏且未删除的
      where.isStarred = true
      where.status = { not: 'deleted' }
    } else {
      // 'archived' 或 'deleted' 精确匹配
      where.status = status
    }

    // 模型精确匹配筛选
    if (model) {
      where.model = model
    }

    // 标题模糊搜索（Prisma 的 contains 相当于 SQL 的 LIKE '%xxx%'）
    if (search) {
      where.title = { contains: search }
    }

    // 标签筛选：关联查询 tags 表中是否存在指定标签
    if (tag) {
      where.tags = {
        some: { tag }  // some 表示至少有一个匹配
      }
    }

    // 日期范围筛选：updatedAt 字段
    if (date_from || date_to) {
      where.updatedAt = {}
      if (date_from) {
        // gte = greater than or equal（大于等于）
        where.updatedAt.gte = new Date(date_from)
      }
      if (date_to) {
        // lte = less than or equal（小于等于）
        where.updatedAt.lte = new Date(date_to)
      }
    }

    // 构建排序条件
    let orderBy: any = {}
    if (sort === 'created_desc') {
      // 按创建时间倒序
      orderBy = { createdAt: 'desc' }
    } else if (sort === 'tokens_desc') {
      // 按 Token 数倒序
      orderBy = { totalTokens: 'desc' }
    } else {
      // 默认按更新时间倒序
      orderBy = { updatedAt: 'desc' }
    }

    // 并行查询：1) 符合条件的对话列表 2) 符合条件的总条数
    const [conversations, total] = await Promise.all([
      // 查询对话列表，包含关联的标签和最新消息预览
      prisma.conversation.findMany({
        where,           // 筛选条件
        orderBy,         // 排序
        skip,            // 跳过条数（分页）
        take: pageSize,  // 取多少条
        include: {
          // 关联查询标签表，只取 tag 字段
          tags: {
            select: { tag: true }
          },
          // 关联查询消息表，取最新一条用户消息作为预览
          messages: {
            where: { role: 'user' },      // 只取用户消息
            orderBy: { createdAt: 'desc' },  // 最新的排前面
            take: 1,                       // 只取一条
            select: { content: true }      // 只取内容字段
          }
        }
      }),
      // 查询符合条件的总条数（用于计算总页数）
      prisma.conversation.count({ where })
    ])

    // 格式化返回数据：添加 preview 和 tags 数组
    const formattedConversations = conversations.map(conv => ({
      // 展开对话所有字段
      ...conv,
      // 提取标签字符串数组（如 ['工作', '重要']）
      tags: conv.tags.map(t => t.tag),
      // 提取预览内容：取最新用户消息的前100字符
      preview: conv.messages[0]?.content?.slice(0, 100) || ''
    }))

    // 计算总页数（向上取整）
    const totalPages = Math.ceil(total / pageSize)

    // 返回成功响应
    return {
      success: true,
      data: {
        conversations: formattedConversations,  // 对话列表
        total,                                   // 总条数
        page,                                    // 当前页码
        pageSize,                                // 每页条数
        totalPages,                              // 总页数
      }
    }
  } catch (e: any) {
    // 捕获异常，返回错误响应
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '获取历史记录失败'
      }
    }
  }
})

// ==================== history.batch_delete ====================
// 批量软删除对话（将状态设为 'deleted'）
// payload: { conversation_ids: string[] }
registerRoute('history.batch_delete', async (payload): Promise<WsResponse> => {
  try {
    // 解构获取对话ID数组
    const { conversation_ids } = payload || {}

    // 验证参数：必须是数组且不为空
    if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'conversation_ids 必须是非空数组'
        }
      }
    }

    // 批量更新：将指定ID的对话状态设为 'deleted'
    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversation_ids }  // in 操作符匹配数组中的任意ID
      },
      data: {
        status: 'deleted'  // 软删除：改状态而非物理删除
      }
    })

    // 返回成功响应，包含删除数量
    return {
      success: true,
      data: {
        deleted: result.count  // 实际删除（更新）的条数
      }
    }
  } catch (e: any) {
    // 捕获异常，返回错误响应
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '批量删除失败'
      }
    }
  }
})

// ==================== history.batch_archive ====================
// 批量归档对话（将状态设为 'archived'）
// payload: { conversation_ids: string[] }
registerRoute('history.batch_archive', async (payload): Promise<WsResponse> => {
  try {
    // 解构获取对话ID数组
    const { conversation_ids } = payload || {}

    // 验证参数：必须是数组且不为空
    if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'conversation_ids 必须是非空数组'
        }
      }
    }

    // 批量更新：将指定ID的对话状态设为 'archived'
    const result = await prisma.conversation.updateMany({
      where: {
        id: { in: conversation_ids }  // in 操作符匹配数组中的任意ID
      },
      data: {
        status: 'archived'  // 归档状态
      }
    })

    // 返回成功响应，包含归档数量
    return {
      success: true,
      data: {
        archived: result.count  // 实际归档（更新）的条数
      }
    }
  } catch (e: any) {
    // 捕获异常，返回错误响应
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '批量归档失败'
      }
    }
  }
})

// ==================== history.batch_tag ====================
// 批量给对话打标签
// payload: { conversation_ids: string[], tags: string[] }
registerRoute('history.batch_tag', async (payload): Promise<WsResponse> => {
  try {
    // 解构获取对话ID数组和标签数组
    const { conversation_ids, tags } = payload || {}

    // 验证参数：conversation_ids 必须是数组且不为空
    if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'conversation_ids 必须是非空数组'
        }
      }
    }

    // 验证参数：tags 必须是数组且不为空
    if (!Array.isArray(tags) || tags.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'tags 必须是非空数组'
        }
      }
    }

    // 构建批量插入的数据：笛卡尔积（每个对话 × 每个标签）
    const rows: { conversationId: string; tag: string }[] = []
    for (const conversationId of conversation_ids) {
      for (const tag of tags) {
        rows.push({ conversationId, tag })
      }
    }

    // 批量创建标签关联
    // 注意：SQLite 不支持 skipDuplicates，使用 try/catch 包裹单个创建来跳过重复
    let createdCount = 0
    for (const row of rows) {
      try {
        // 逐个创建，遇到重复（@@unique 约束冲突）会抛错，捕获后跳过
        await prisma.conversationTag.create({ data: row })
        createdCount++
      } catch {
        // 重复键错误，跳过这条
      }
    }

    // 返回成功响应，包含打标签数量
    return {
      success: true,
      data: {
        tagged: createdCount  // 实际创建的关联条数
      }
    }
  } catch (e: any) {
    // 捕获异常，返回错误响应
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '批量打标签失败'
      }
    }
  }
})

// ==================== history.batch_export ====================
// 批量导出对话内容
// payload: { conversation_ids: string[], format='md' }
// format: 'json' | 'md'（默认 markdown）
registerRoute('history.batch_export', async (payload): Promise<WsResponse> => {
  try {
    // 解构获取参数，format 默认为 'md'
    const { conversation_ids, format = 'md' } = payload || {}

    // 验证参数：必须是数组且不为空
    if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'conversation_ids 必须是非空数组'
        }
      }
    }

    // 查询指定对话及其关联数据（消息和标签）
    const conversations = await prisma.conversation.findMany({
      where: {
        id: { in: conversation_ids }
      },
      include: {
        // 关联查询所有消息，按时间正序排列
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        // 关联查询所有标签
        tags: {
          select: { tag: true }
        }
      },
      // 按更新时间倒序排列导出的对话
      orderBy: { updatedAt: 'desc' }
    })

    let content: string

    // 根据格式生成导出内容
    if (format === 'json') {
      // JSON 格式：直接序列化为格式化的 JSON 字符串
      content = JSON.stringify(conversations, null, 2)
    } else {
      // Markdown 格式：手动构建
      const parts: string[] = []

      for (const conv of conversations) {
        // 对话标题作为一级标题
        parts.push(`# ${conv.title || '未命名对话'}`)
        parts.push('')

        // 元信息块
        parts.push(`**模型**: ${conv.model || '未知'}`)
        parts.push(`**创建时间**: ${conv.createdAt.toISOString()}`)
        parts.push(`**更新时间**: ${conv.updatedAt.toISOString()}`)
        parts.push(`**消息数**: ${conv.messageCount}`)
        parts.push(`**Token 数**: ${conv.totalTokens}`)

        // 标签列表
        if (conv.tags.length > 0) {
          parts.push(`**标签**: ${conv.tags.map(t => t.tag).join(', ')}`)
        }

        parts.push('')
        parts.push('---')  // 分隔线
        parts.push('')

        // 消息内容
        for (const msg of conv.messages) {
          // 根据角色选择标题级别
          const roleLabel = msg.role === 'user' ? '## 用户' : '## AI'
          parts.push(`${roleLabel} (${msg.createdAt.toISOString()})`)
          parts.push('')
          parts.push(msg.content)
          parts.push('')
        }

        parts.push('---')  // 对话结束分隔线
        parts.push('')
      }

      content = parts.join('\n')
    }

    // 返回成功响应，包含导出内容和格式
    return {
      success: true,
      data: {
        content,   // 导出的内容字符串
        format     // 格式标识
      }
    }
  } catch (e: any) {
    // 捕获异常，返回错误响应
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '批量导出失败'
      }
    }
  }
})

// ==================== history.recover ====================
// 恢复已删除的对话（将状态从 'deleted' 改回 'active'）
// payload: { conversation_id: string }
registerRoute('history.recover', async (payload): Promise<WsResponse> => {
  try {
    // 解构获取对话ID
    const { conversation_id } = payload || {}

    // 验证参数：必须提供对话ID
    if (!conversation_id) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'conversation_id 不能为空'
        }
      }
    }

    // 查找对话，确认存在且状态为 deleted
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversation_id }
    })

    // 对话不存在
    if (!conversation) {
      return {
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: '对话不存在'
        }
      }
    }

    // 对话不是已删除状态，无法恢复
    if (conversation.status !== 'deleted') {
      return {
        success: false,
        error: {
          code: 'NOT_DELETED',
          message: '该对话不是已删除状态，无法恢复'
        }
      }
    }

    // 更新状态为 'active'
    await prisma.conversation.update({
      where: { id: conversation_id },
      data: { status: 'active' }
    })

    // 返回成功响应
    return {
      success: true,
      data: {
        recovered: conversation_id  // 恢复的对话ID
      }
    }
  } catch (e: any) {
    // 捕获异常，返回错误响应
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '恢复对话失败'
      }
    }
  }
})

// ==================== history.summarize ====================
// 使用 AI 生成对话摘要
// payload: { conversation_id: string }
registerRoute('history.summarize', async (payload): Promise<WsResponse> => {
  try {
    // 解构获取对话ID
    const { conversation_id } = payload || {}

    // 验证参数：必须提供对话ID
    if (!conversation_id) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'conversation_id 不能为空'
        }
      }
    }

    // 查找对话及其所有消息
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversation_id },
      include: {
        // 关联查询所有消息，按时间正序排列
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    // 对话不存在
    if (!conversation) {
      return {
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: '对话不存在'
        }
      }
    }

    // 验证对话有消息内容
    if (!conversation.messages || conversation.messages.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_MESSAGES',
          message: '对话没有消息，无法生成摘要'
        }
      }
    }

    // 查找一个可用的 API Key（需要关联厂商信息获取 baseUrl）
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        status: 'active',     // 状态活跃
        isDeleted: false      // 未被删除
      },
      include: {
        provider: true        // 关联查询厂商信息（需要 baseUrl）
      }
    })

    // 没有可用的 API Key
    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'NO_ACTIVE_KEY',
          message: '没有可用的 API Key，无法生成摘要'
        }
      }
    }

    // 将消息格式化为 AI API 需要的格式
    const apiMessages = conversation.messages.map(m => ({
      role: m.role,           // 'user' 或 'assistant'
      content: m.content      // 消息内容
    }))

    // 调用 AI 服务生成摘要
    const summary = await summarizeChat(
      apiKey.provider.baseUrl,      // 厂商 API 地址
      apiKey.encryptedKey,          // 加密的 API Key
      conversation.model,           // 对话使用的模型
      apiMessages                   // 格式化的消息数组
    )

    // 将生成的摘要保存到对话记录中
    await prisma.conversation.update({
      where: { id: conversation_id },
      data: { summary }  // 更新 summary 字段
    })

    // 返回成功响应，包含生成的摘要
    return {
      success: true,
      data: {
        summary  // AI 生成的摘要内容
      }
    }
  } catch (e: any) {
    // 捕获异常，返回错误响应
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '生成摘要失败'
      }
    }
  }
})
