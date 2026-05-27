// dashboardStore.ts —— 仪表盘首页数据状态管理
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wsClient } from '@/composables/useWs'

// 仪表盘聚合数据类型定义
export interface DashboardSummary {
  usage: {
    tokens_today: number // 今日 Token 消耗
    tokens_month: number // 本月 Token 消耗
    cost_cents_today: number // 今日费用（分）
    cost_cents_month: number // 本月费用（分）
    conversations_today: number // 今日对话次数
    conversations_month: number // 本月对话次数
  }
  model_ranking: { model: string; tokens: number; percentage: number }[] // 模型使用排行
  recent_conversations: {
    id: string // 会话 ID
    title: string // 会话标题
    model: string // 使用的模型
    updatedAt: string // 最后更新时间
    messageCount: number // 消息数
  }[] // 最近对话列表
  today_tasks: any[] // 今日待办（暂未实现）
}

export const useDashboardStore = defineStore('dashboard', () => {
  // 聚合数据
  const summary = ref<DashboardSummary | null>(null)
  // 加载状态
  const loading = ref(false)

  // 拉取仪表盘数据
  async function fetchSummary() {
    loading.value = true
    try {
      summary.value = await wsClient.send<DashboardSummary>('dashboard.summary')
    } finally {
      loading.value = false
    }
  }

  return { summary, loading, fetchSummary }
})
