// ============================================================
// chatHandler.ts —— 会话和消息的处理函数
// 负责 conversations.* 和 messages.* 系列 action
// 这是整个应用最核心的模块 —— 流式 AI 对话
//
// 流式对话的工作原理：
//   1. 前端发 messages.send → 后端立即返回 { mode: 'stream' }
//   2. 后端异步调 AI 厂商 API（stream=true）
//   3. 厂商逐 token 推送 → 后端通过 ctx.push() 实时推前端
//   4. 前端监听到 stream_chunk 帧 → 追加到消息内容
//   5. 流结束 → 后端推 stream_end 帧 → 更新数据库
//
// action 清单：
//   conversations.list    — 获取会话列表
//   conversations.create  — 新建会话
//   conversations.delete  — 删除会话
//   conversations.update  — 更新会话（改名/改模型）
//   messages.list        — 获取消息历史
//   messages.send        — 发送消息（核心：流式对话）
//   messages.regenerate  — 重新生成最后一条 AI 回复
// ============================================================

import { prisma } from '../db'
import { registerRoute } from '../wsRouter'
import type { WsResponse } from '../wsRouter'
import { streamChat } from '../services/aiService'

// ==================== conversations.list ====================
// 获取会话列表（左侧栏显示用）
// 只显示 active 状态的会话，按最近聊天时间倒序
registerRoute('conversations.list', async (): Promise<WsResponse> => {
  const list = await prisma.conversation.findMany({
    where: { status: 'active' },         // 只查活跃会话
    orderBy: { updatedAt: 'desc' },      // 最近修改的排最上面
    take: 50,                            // 最多取 50 条（防止数据太多卡顿）
  })
  return { success: true, data: list }
})

// ==================== conversations.create ====================
// 新建一个空会话（还没有消息）
// payload: { title?, model? }
registerRoute('conversations.create', async (payload): Promise<WsResponse> => {
  const { title, model } = payload || {}

  // 创建会话记录
  const conv = await prisma.conversation.create({
    data: {
      title: title || '新对话',             // 标题默认"新对话"
      model: model || 'deepseek-v4-pro',            // 模型默认 deepseek-v4-pro
    },
  })

  return { success: true, data: conv }
})

// ==================== conversations.delete ====================
// 删除会话（软删除：把 status 改成 archived）
// payload: { conversationId }
registerRoute('conversations.delete', async (payload): Promise<WsResponse> => {
  await prisma.conversation.update({
    where: { id: payload.conversationId },
    data: { status: 'archived' },        // SQLite 不能设 enum，用字符串
  })
  return { success: true, data: { message: '已删除' } }
})

// ==================== conversations.update ====================
// 更新会话信息（标题或模型）
// payload: { conversationId, title?, model? }
registerRoute('conversations.update', async (payload): Promise<WsResponse> => {
  const { conversationId, title, model } = payload

  // 只更新传了值的字段
  const data: any = {}
  if (title !== undefined) data.title = title
  if (model !== undefined) data.model = model

  await prisma.conversation.update({
    where: { id: conversationId },
    data,
  })

  return { success: true, data: { message: '已更新' } }
})

// ==================== messages.list ====================
// 获取某个会话的消息历史
// payload: { conversationId }
registerRoute('messages.list', async (payload): Promise<WsResponse> => {
  // 查会话 + 关联的所有消息
  // include 是 Prisma 的联表查询语法
  // messages: { orderBy: { createdAt: 'asc' } }  消息按时间正序（旧的在前）
  const conv = await prisma.conversation.findUnique({
    where: { id: payload.conversationId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  if (!conv) {
    return {
      success: false,
      error: { code: 'CONVERSATION_NOT_FOUND', message: '会话不存在' },
    }
  }

  return { success: true, data: { conversation: conv, messages: conv.messages } }
})

// ==================== messages.send（核心）============
// 发送消息并以流式方式获取 AI 回复
// payload: { conversationId, content, model? }
//
// 整个流程分三个部分：
//   A. 同步准备：校验会话、找 Key、保存用户消息、创建 AI 占位、更新会话
//   B. 异步流式调用：调 AI 厂商 API，逐 token 推送到前端
//   C. 立即返回：告诉前端流式即将开始
registerRoute('messages.send', async (payload, _token, ctx): Promise<WsResponse> => {
  const { conversationId, content, model } = payload

  // ==================== A. 同步准备 ====================

  // --- A1. 查找会话 ---
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  })
  if (!conversation) {
    return {
      success: false,
      error: { code: 'CONVERSATION_NOT_FOUND', message: '会话不存在' },
    }
  }

  // --- A2. 查找可用的 API Key ---
  // findFirst 取第一个匹配的（status='active' 且未删除）
  // include: { provider: true } 同时查出厂商信息（需要 baseUrl）
  const apiKey = await prisma.apiKey.findFirst({
    where: { status: 'active', isDeleted: false },
    include: { provider: true },
  })
  if (!apiKey) {
    return {
      success: false,
      error: {
        code: 'NO_ACTIVE_KEY',
        message: '没有可用的 API Key，请先在 API Key 页面添加一个',
      },
    }
  }

  // --- A3. 保存用户消息到 messages 表 ---
  const userMsg = await prisma.message.create({
    data: { conversationId, role: 'user', content },
  })

  // --- A4. 创建空的 AI 消息（占位）---
  // 内容为空，等流式结束后再更新
  const currentModel = model || conversation.model || 'deepseek-v4-pro'
  const assistantMsg = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: '',                          // 开始为空
      model: currentModel,
    },
  })

  // --- A5. 更新会话信息 ---
  // messageCount: { increment: 2 }  消息数 +2（用户消息 + AI 消息）
  // 如果是第一条消息 → 用用户消息前 30 字做标题
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      messageCount: { increment: 2 },
      updatedAt: new Date(),
      // ...展开运算符：如果第一条消息，加上 { title: "前30字" }
      ...(conversation.messageCount === 0
        ? { title: content.slice(0, 30) }
        : {}),
    },
  })

  // --- A6. 获取历史消息，构建 AI API 需要的 messages 数组 ---
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 40,                              // 取最近 40 条作为上下文
  })

  // 把数据库消息转成 AI API 的格式
  // { role: "user" | "assistant", content: "..." }
  const apiMessages = history.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))

  // ==================== B. 异步流式调用 ====================

  // fullContent 数组收集所有文本碎片
  // 用数组而不是字符串拼接，是为了提高性能
  const fullContent: string[] = []

  // streamChat 是异步的，不会阻塞这里的 return
  streamChat(
    // --- 参数1：厂商的 API 地址 ---
    apiKey.provider.baseUrl,
    // --- 参数2：加密的 Key（streamChat 内部会解密）---
    apiKey.encryptedKey,
    // --- 参数3：模型名 ---
    currentModel,
    // --- 参数4：消息历史 ---
    apiMessages,
    // --- 参数5：onChunk 回调（每收到一个 token 调用一次）---
    (chunk: string) => {
      // 把 token 存入数组
      fullContent.push(chunk)
      // 通过 ctx.push() 推送给前端 stream_chunk 帧
      // message_id 用于前端确认这是哪个 AI 消息的内容
      ctx?.push('stream_chunk', {
        message_id: assistantMsg.id,
        chunk,
      })
    },
    // --- 参数6：onDone 回调（流正常结束）---
    async (totalTokens: number) => {
      // B1. 拼接所有 token 成完整消息
      const finalContent = fullContent.join('')
      // B2. 更新消息内容和 Token 数
      await prisma.message.update({
        where: { id: assistantMsg.id },
        data: { content: finalContent, tokenCount: totalTokens },
      })
      // B3. 更新会话累计 Token
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { totalTokens: { increment: totalTokens } },
      })
      // B4. 记录用量（后续可用于统计）
      await prisma.tokenUsageRecord.create({
        data: {
          keyId: apiKey.id,
          modelName: currentModel,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostCents: 0,
          sessionId: conversationId,
        },
      })
      // B5. 推送流结束帧
      ctx?.push('stream_end', {
        message_id: assistantMsg.id,
        token_count: totalTokens,
        model: currentModel,
      })
    },
    // --- 参数7：onError 回调（流出错）---
    (error: string) => {
      // 把错误信息写入消息内容
      prisma.message
        .update({
          where: { id: assistantMsg.id },
          data: { content: `[错误] ${error}` },
        })
        .catch(() => {}) // 静默处理更新失败（比如消息已被删除）

      // 推送错误帧
      ctx?.push('stream_error', {
        message_id: assistantMsg.id,
        error: { code: 'STREAM_ERROR', message: error },
      })
    },
  )

  // ==================== C. 立即返回 ====================
  // handler 返回后流还在后台继续
  // 前端收到这个响应就知道流式要开始了，然后监听 stream_chunk 帧
  return {
    success: true,
    data: {
      mode: 'stream',
      user_message_id: userMsg.id,
      assistant_message_id: assistantMsg.id,
      model: currentModel,
    },
  }
})

// ==================== messages.regenerate ====================
// 重新生成最后一条 AI 回复
// 用户对 AI 的回复不满意 → 点「重新生成」
//
// 流程：
//   1. 删除旧的 AI 消息
//   2. 创建新的空 AI 消息
//   3. 用同样的历史重新调 AI 厂商 API
//   4. 流式返回新的回复
//
// payload: { conversationId }
registerRoute('messages.regenerate', async (payload, _token, ctx): Promise<WsResponse> => {
  const { conversationId } = payload

  // --- 1. 验证会话存在 ---
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
  })
  if (!conv) {
    return {
      success: false,
      error: { code: 'CONVERSATION_NOT_FOUND', message: '会话不存在' },
    }
  }

  // --- 2. 取最后两条消息 ---
  // orderBy: { createdAt: 'desc' }  按时间倒序（最新的在前）
  // take: 2  只取最后两条
  const lastMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 2,
  })

  // find 在数组中找到第一个匹配的元素
  const lastAssistant = lastMessages.find(m => m.role === 'assistant')
  const lastUser = lastMessages.find(m => m.role === 'user')

  // 必须有一条用户消息才能重新生成
  if (!lastUser) {
    return {
      success: false,
      error: { code: 'NO_USER_MESSAGE', message: '没有可重新生成的消息' },
    }
  }

  // --- 3. 删除旧的 AI 消息（这次是真的 delete，不是软删除）---
  if (lastAssistant) {
    await prisma.message.delete({ where: { id: lastAssistant.id } })
  }

  // --- 4. 找可用 Key ---
  const apiKey = await prisma.apiKey.findFirst({
    where: { status: 'active', isDeleted: false },
    include: { provider: true },
  })
  if (!apiKey) {
    return {
      success: false,
      error: { code: 'NO_ACTIVE_KEY', message: '没有可用的 API Key' },
    }
  }

  const currentModel = conv.model || 'deepseek-v4-pro'

  // --- 5. 创建新的空 AI 消息 ---
  const assistantMsg = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: '',
      model: currentModel,
    },
  })

  // --- 6. 获取当前消息历史（旧的 AI 消息已删除）---
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 40,
  })
  const apiMessages = history.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))

  // --- 7. 异步流式调用（和 messages.send 流程一样）---
  const fullContent: string[] = []
  streamChat(
    apiKey.provider.baseUrl,
    apiKey.encryptedKey,
    currentModel,
    apiMessages,
    (chunk) => {
      fullContent.push(chunk)
      ctx?.push('stream_chunk', { message_id: assistantMsg.id, chunk })
    },
    async (totalTokens) => {
      await prisma.message.update({
        where: { id: assistantMsg.id },
        data: { content: fullContent.join(''), tokenCount: totalTokens },
      })
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { totalTokens: { increment: totalTokens } },
      })
      await prisma.tokenUsageRecord.create({
        data: {
          keyId: apiKey.id,
          modelName: currentModel,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostCents: 0,
          sessionId: conversationId,
        },
      })
      ctx?.push('stream_end', {
        message_id: assistantMsg.id,
        token_count: totalTokens,
        model: currentModel,
      })
    },
    (error) => {
      prisma.message
        .update({
          where: { id: assistantMsg.id },
          data: { content: `[错误] ${error}` },
        })
        .catch(() => {})
      ctx?.push('stream_error', {
        message_id: assistantMsg.id,
        error: { code: 'STREAM_ERROR', message: error },
      })
    },
  )

  // --- 8. 立即返回流式开始信号 ---
  return {
    success: true,
    data: {
      mode: 'stream',
      assistant_message_id: assistantMsg.id,
      model: currentModel,
    },
  }
})
