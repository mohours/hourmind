// ============================================================
// taskHandler.ts —— 个人待办事项处理函数
// 负责 tasks.* 和 subtasks.* 系列 action
//
// action 清单：
//   tasks.list       — 任务列表（支持状态/优先级筛选 + 排序）
//   tasks.create     — 创建任务
//   tasks.update     — 编辑任务（标题/描述/优先级/截止日期等）
//   tasks.toggle     — 切换完成状态
//   tasks.delete     — 删除任务
//   tasks.set_status — 切换状态（todo/in_progress/done/archived）
//   tasks.decompose  — AI 智能拆解：把一个任务拆成多个子步骤
//   subtasks.create  — 添加子任务
//   subtasks.toggle  — 勾选/取消子任务
//   subtasks.delete  — 删除子任务
// ============================================================

import { prisma } from '../db'
import { registerRoute } from '../wsRouter'
import type { WsResponse } from '../wsRouter'
// AI 服务：用于任务拆解（非流式调 AI 生成子任务列表）
import { summarizeChat } from '../services/aiService'

// ==================== tasks.list ====================
// 获取任务列表
// payload: { status?, priority?, sort? }
registerRoute('tasks.list', async (payload): Promise<WsResponse> => {
  try {
    const { status, priority, sort } = payload || {}

    // 构建筛选条件
    const where: any = {}
    if (status && status !== 'all') where.status = status
    if (priority && priority !== 'all') where.priority = priority

    // 排序：默认按创建时间倒序
    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'due_asc') orderBy = { dueDate: 'asc' }
    else if (sort === 'priority_desc') orderBy = [{ priority: 'asc' }, { createdAt: 'desc' }]

    const tasks = await prisma.task.findMany({
      where,
      orderBy,
      include: {
        subtasks: { orderBy: { order: 'asc' } }, // 子任务按序号排序
      },
    })

    return { success: true, data: tasks }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== tasks.create ====================
// 创建新任务
// payload: { title, description?, priority?, dueDate?, tags? }
registerRoute('tasks.create', async (payload): Promise<WsResponse> => {
  try {
    const { title, description, priority, dueDate, tags } = payload

    if (!title || !title.trim()) {
      return { success: false, error: { code: 'MISSING_FIELDS', message: '任务标题不能为空' } }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        priority: priority || 'medium',
        status: 'todo',
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: JSON.stringify(tags || []),
      },
      include: { subtasks: true },
    })

    return { success: true, data: task }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== tasks.update ====================
// 编辑任务
// payload: { taskId, title?, description?, priority?, dueDate?, tags? }
registerRoute('tasks.update', async (payload): Promise<WsResponse> => {
  try {
    const { taskId, title, description, priority, dueDate, tags } = payload

    const data: any = {}
    if (title !== undefined) data.title = title.trim()
    if (description !== undefined) data.description = description
    if (priority !== undefined) data.priority = priority
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null
    if (tags !== undefined) data.tags = JSON.stringify(tags)

    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: { subtasks: { orderBy: { order: 'asc' } } },
    })

    return { success: true, data: task }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== tasks.toggle ====================
// 切换完成状态（勾选/取消勾选）
// payload: { taskId }
registerRoute('tasks.toggle', async (payload): Promise<WsResponse> => {
  try {
    const { taskId } = payload

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) return { success: false, error: { code: 'TASK_NOT_FOUND', message: '任务不存在' } }

    const isCompleted = task.status === 'done'
    const newStatus = isCompleted ? 'todo' : 'done'
    const completedAt = isCompleted ? null : new Date()

    await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus, completedAt },
    })

    return { success: true, data: { status: newStatus } }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== tasks.delete ====================
// 删除任务（及关联子任务）
// payload: { taskId }
registerRoute('tasks.delete', async (payload): Promise<WsResponse> => {
  try {
    const { taskId } = payload

    // 先删子任务，再删主任务
    await prisma.subtask.deleteMany({ where: { taskId } })
    await prisma.task.delete({ where: { id: taskId } })

    return { success: true, data: { message: '已删除' } }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== tasks.set_status ====================
// 切换任务状态（todo → in_progress → done → archived）
// payload: { taskId, status }
registerRoute('tasks.set_status', async (payload): Promise<WsResponse> => {
  try {
    const { taskId, status } = payload
    const validStatuses = ['todo', 'in_progress', 'done', 'archived']
    if (!validStatuses.includes(status)) {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '无效的状态值' } }
    }

    const data: any = { status }
    if (status === 'done') data.completedAt = new Date()
    else data.completedAt = null

    await prisma.task.update({ where: { id: taskId }, data })

    return { success: true, data: { status } }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== tasks.decompose ====================
// AI 智能拆解：把一个任务拆成 3-5 个子步骤
// payload: { taskId }
//
// 流程：
//   1. 查任务标题 + 描述
//   2. 找可用 API Key
//   3. 调 AI（非流式），让模型生成子任务 JSON 列表
//   4. 解析 JSON → 逐条插入 subtasks 表
registerRoute('tasks.decompose', async (payload): Promise<WsResponse> => {
  try {
    const { taskId } = payload

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) return { success: false, error: { code: 'TASK_NOT_FOUND', message: '任务不存在' } }

    // 找可用 Key
    const apiKey = await prisma.apiKey.findFirst({
      where: { status: 'active', isDeleted: false },
      include: { provider: true },
    })
    if (!apiKey) return { success: false, error: { code: 'NO_ACTIVE_KEY', message: '没有可用的 API Key' } }

    // 构造拆分 prompt
    const prompt = `请将以下任务拆解为 3-5 个具体的子步骤。只返回 JSON 数组，不要加任何说明。

任务标题：${task.title}
${task.description ? `任务描述：${task.description}` : ''}

返回格式示例：
["步骤1的具体内容", "步骤2的具体内容", "步骤3的具体内容"]`

    // 调 AI（复用 summarizeChat 的非流式调用模式）
    const { decrypt } = await import('../services/cryptoService')
    let apiKeyPlain: string
    try {
      apiKeyPlain = decrypt(apiKey.encryptedKey)
    } catch {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Key 解密失败' } }
    }

    const res = await fetch(`${apiKey.provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKeyPlain}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: task.sourceConversationId ? 'deepseek-v4-pro' : 'deepseek-v4-pro',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      return { success: false, error: { code: 'AI_ERROR', message: 'AI 拆解失败' } }
    }

    const data = (await res.json()) as any
    const text = data.choices?.[0]?.message?.content || '[]'

    // 从回复中提取 JSON 数组
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return { success: false, error: { code: 'PARSE_ERROR', message: 'AI 返回格式异常' } }
    }

    let steps: string[]
    try {
      steps = JSON.parse(jsonMatch[0])
    } catch {
      return { success: false, error: { code: 'PARSE_ERROR', message: 'AI 返回 JSON 解析失败' } }
    }

    // 逐个插入子任务
    const subtasks = []
    for (let i = 0; i < steps.length; i++) {
      const st = await prisma.subtask.create({
        data: {
          taskId,
          title: steps[i],
          order: i,
        },
      })
      subtasks.push(st)
    }

    return { success: true, data: subtasks }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== subtasks.create ====================
// 手动添加子任务
// payload: { taskId, title }
registerRoute('subtasks.create', async (payload): Promise<WsResponse> => {
  try {
    const { taskId, title } = payload
    if (!title || !title.trim()) {
      return { success: false, error: { code: 'MISSING_FIELDS', message: '子任务标题不能为空' } }
    }

    // 计算下一个序号
    const lastSubtask = await prisma.subtask.findFirst({
      where: { taskId },
      orderBy: { order: 'desc' },
    })
    const nextOrder = (lastSubtask?.order ?? -1) + 1

    const subtask = await prisma.subtask.create({
      data: { taskId, title: title.trim(), order: nextOrder },
    })

    return { success: true, data: subtask }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== subtasks.toggle ====================
// 勾选/取消子任务
// payload: { subtaskId }
registerRoute('subtasks.toggle', async (payload): Promise<WsResponse> => {
  try {
    const { subtaskId } = payload

    const st = await prisma.subtask.findUnique({ where: { id: subtaskId } })
    if (!st) return { success: false, error: { code: 'SUBTASK_NOT_FOUND', message: '子任务不存在' } }

    const updated = await prisma.subtask.update({
      where: { id: subtaskId },
      data: { isCompleted: !st.isCompleted },
    })

    return { success: true, data: updated }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})

// ==================== subtasks.delete ====================
// 删除子任务
// payload: { subtaskId }
registerRoute('subtasks.delete', async (payload): Promise<WsResponse> => {
  try {
    const { subtaskId } = payload
    await prisma.subtask.delete({ where: { id: subtaskId } })
    return { success: true, data: { message: '已删除' } }
  } catch (e: any) {
    return { success: false, error: { code: 'INTERNAL_ERROR', message: e.message } }
  }
})
