// ============================================================
// dashboardHandler.ts —— 仪表盘数据处理函数
// 负责 dashboard.summary action —— 聚合查询仪表盘所需全部数据
//
// 聚合数据来源：
//   token_usage_records → 今日/本月 Token + 费用
//   messages → 今日/本月对话次数
//   conversations → 最近对话列表
//   token_usage_records → 模型使用排行
// ============================================================

// 数据库连接（Prisma Client）
import { prisma } from '../db'
// 路由注册函数
import { registerRoute } from '../wsRouter'
// 响应类型定义
import type { WsResponse } from '../wsRouter'

// ==================== dashboard.summary ====================
// 仪表盘首页数据聚合接口
// 一次请求返回：用量统计 + 模型排行 + 最近对话
// payload: { period? } —— 'today' / 'week' / 'month'，默认 today
registerRoute('dashboard.summary', async (payload): Promise<WsResponse> => {
  try {
    // ==================== 1. 计算时间范围 ====================
    const now = new Date() // 当前时间

    // 今日开始时间（00:00:00.000）
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 本月开始时间（本月 1 号 00:00:00.000）
    // new Date(年, 月, 日) — 月份从 0 开始，0=1月
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // ==================== 2. Token + 费用统计 ====================

    // 查询今日的 Token 用量记录
    // gte = greater than or equal（>=）
    const todayRecords = await prisma.tokenUsageRecord.findMany({
      where: { recordedAt: { gte: todayStart } },
    })

    // 查询本月的 Token 用量记录
    const monthRecords = await prisma.tokenUsageRecord.findMany({
      where: { recordedAt: { gte: monthStart } },
    })

    // 累加今日 Token 消耗（promptTokens + completionTokens）
    const tokensToday = todayRecords.reduce(
      (sum, r) => sum + r.promptTokens + r.completionTokens,
      0, // 初始值
    )

    // 累加本月 Token 消耗
    const tokensMonth = monthRecords.reduce(
      (sum, r) => sum + r.promptTokens + r.completionTokens,
      0,
    )

    // 累加今日费用（estimatedCostCents，单位：分）
    const costCentsToday = todayRecords.reduce(
      (sum, r) => sum + r.estimatedCostCents,
      0,
    )

    // 累加本月费用
    const costCentsMonth = monthRecords.reduce(
      (sum, r) => sum + r.estimatedCostCents,
      0,
    )

    // ==================== 3. 对话次数统计 ====================

    // 统计今日用户发送的消息数（role='user'）
    const conversationsToday = await prisma.message.count({
      where: {
        role: 'user', // 只统计用户消息
        createdAt: { gte: todayStart }, // 今天创建的
      },
    })

    // 统计本月用户发送的消息数
    const conversationsMonth = await prisma.message.count({
      where: {
        role: 'user',
        createdAt: { gte: monthStart },
      },
    })

    // ==================== 4. 模型使用排行 ====================

    // 获取本月所有 Token 记录，按 modelName 分组聚合
    const monthModelRecords = await prisma.tokenUsageRecord.findMany({
      where: { recordedAt: { gte: monthStart } },
    })

    // 按模型名分组聚合 Token 数
    const modelTokens: Record<string, number> = {}
    // for...of 遍历：每一条记录按 modelName 累加
    for (const r of monthModelRecords) {
      // r.modelName 就是模型名，如 "gpt-4o"、"claude-3-5-sonnet-20241022"
      const key = r.modelName || 'unknown' // 防止空值
      // 如果这个模型还没在对象里，初始化为 0，然后累加
      if (!modelTokens[key]) modelTokens[key] = 0
      modelTokens[key] += r.promptTokens + r.completionTokens
    }

    // 计算总 Token 数（用于百分比）
    const totalModelTokens = Object.values(modelTokens).reduce(
      (sum, t) => sum + t,
      0,
    )

    // 转成数组并排序：按 Token 数降序
    const modelRanking = Object.entries(modelTokens)
      // map 把 { "gpt-4o": 120000 } 转成 { model, tokens, percentage }
      .map(([model, tokens]) => ({
        model, // 模型名
        tokens, // Token 数
        // 百分比，保留整数。如果总数 0 则为 0
        percentage:
          totalModelTokens > 0
            ? Math.round((tokens / totalModelTokens) * 100)
            : 0,
      }))
      // sort 按 Token 数降序排列
      .sort((a, b) => b.tokens - a.tokens)
      // take 5 取前 5 名
      .slice(0, 5)

    // ==================== 5. 最近对话 ====================

    // 取最近 6 条活跃会话
    const recentConversations = await prisma.conversation.findMany({
      where: { status: 'active' }, // 只查活跃会话
      orderBy: { updatedAt: 'desc' }, // 最近修改的排前面
      take: 6, // 最多 6 条
      // select 只取需要的字段（不查关联 messages）
      select: {
        id: true,
        title: true,
        model: true,
        updatedAt: true,
        messageCount: true,
      },
    })

    // ==================== 6. 返回聚合数据 ====================

    return {
      success: true,
      data: {
        // 用量统计
        usage: {
          tokens_today: tokensToday, // 今日 Token 消耗
          tokens_month: tokensMonth, // 本月 Token 消耗
          cost_cents_today: costCentsToday, // 今日费用（分）
          cost_cents_month: costCentsMonth, // 本月费用（分）
          conversations_today: conversationsToday, // 今日对话次数
          conversations_month: conversationsMonth, // 本月对话次数
        },
        // 模型使用排行
        model_ranking: modelRanking,
        // 最近对话
        recent_conversations: recentConversations,
        // 今日待办（tasks 表尚未创建，返回空数组占位）
        today_tasks: [],
      },
    }
  } catch (e: any) {
    // 出错时返回错误信息
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '获取仪表盘数据失败',
      },
    }
  }
})
