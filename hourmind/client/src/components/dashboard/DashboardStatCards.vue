<!--
 DashboardStatCards.vue —— 仪表盘统计卡片行
 显示 3 张玻璃卡片：今日 Token / 今日对话 / 本月费用
 复用 KeysView 中的玻璃卡片样式
-->
<template>
  <div class="stat-row">
    <!-- v-for 循环渲染 3 张卡片 -->
    <!-- cards 数组定义了每张卡片的标签和数据键 -->
    <div
      v-for="card in cards"
      :key="card.key"
      class="glass-card stat-card"
    >
      <!-- 卡片标签：灰色小字 -->
      <span class="stat-label">{{ card.label }}</span>
      <!-- 卡片数值：大号粗体 -->
      <span class="stat-value">{{ formatValue(card.key) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 从父组件接收仪表盘数据
import { computed } from 'vue'
import type { DashboardSummary } from '@/stores/dashboardStore'

const props = defineProps<{
  summary: DashboardSummary | null // 仪表盘聚合数据（可能为空）
}>()

// 定义 3 张统计卡片
const cards = [
  { label: '今日 Token', key: 'tokens_today' as const }, // 今日 Token 消耗
  { label: '今日对话', key: 'conversations_today' as const }, // 今日对话次数
  { label: '本月费用', key: 'cost_cents_month' as const }, // 本月费用（分）
]

// 格式化卡片数值
function formatValue(key: 'tokens_today' | 'conversations_today' | 'cost_cents_month'): string {
  // summary 为 null 时显示 0
  if (!props.summary) return '0'
  const usage = props.summary.usage // 用量数据
  if (key === 'tokens_today') {
    // Token 数用千分位格式化（如 12,400）
    return usage.tokens_today.toLocaleString()
  }
  if (key === 'conversations_today') {
    // 对话次数直接显示数字
    return String(usage.conversations_today)
  }
  // 费用：从分转美元，保留 2 位小数
  return '$' + (usage.cost_cents_month / 100).toFixed(2)
}
</script>

<style scoped>
/* 统计卡片行：横向 Flex 布局 */
.stat-row {
  display: flex; /* Flex 布局 */
  gap: 16px; /* 卡片间距 */
  margin-bottom: 28px; /* 底部间距 */
}

/* 每张卡片等宽 */
.stat-card {
  flex: 1; /* 等分剩余空间 */
  padding: 20px 24px; /* 内部间距 */
  display: flex; /* Flex 列布局 */
  flex-direction: column; /* 纵向排列 */
  gap: 6px; /* 标签和数值的间距 */
}

/* 卡片标签 */
.stat-label {
  font-size: 13px; /* 小号字体 */
  color: #94A3B8; /* 石板灰 */
}

/* 卡片数值 */
.stat-value {
  font-size: 28px; /* 大号数字 */
  font-weight: 700; /* 粗体 */
  background: linear-gradient(135deg, #F1F5F9, #00E5D8); /* 渐变文字 */
  -webkit-background-clip: text; /* 文字裁剪 */
  -webkit-text-fill-color: transparent; /* 透明显示渐变 */
  background-clip: text;
}
</style>
