<!--
 DashboardView.vue —— 仪表盘首页
 Quantum Glass 风格
 三区域布局：欢迎栏 + 统计卡片 + 快速入口 + 最近对话
-->
<template>
  <div class="dashboard">
    <!-- 顶部：欢迎栏（动态问候 + 日期 + 新对话按钮） -->
    <DashboardWelcome />

    <!-- 加载中提示 -->
    <div v-if="ds.loading && !ds.summary" class="loading-hint text-muted">加载中...</div>

    <!-- 数据加载完成后展示 -->
    <template v-else>
      <!-- 统计卡片行：今日 Token / 今日对话 / 本月费用 -->
      <DashboardStatCards :summary="ds.summary" />

      <!-- 快速入口：4 个玻璃卡片 -->
      <DashboardQuickEntry />

      <!-- 最近对话列表 -->
      <DashboardRecentConversations
        :conversations="ds.summary?.recent_conversations || []"
        :loading="false"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// 页面挂载时加载数据
import { onMounted } from 'vue'
// 仪表盘数据 store
import { useDashboardStore } from '@/stores/dashboardStore'
// 子组件
import DashboardWelcome from '@/components/dashboard/DashboardWelcome.vue'
import DashboardStatCards from '@/components/dashboard/DashboardStatCards.vue'
import DashboardQuickEntry from '@/components/dashboard/DashboardQuickEntry.vue'
import DashboardRecentConversations from '@/components/dashboard/DashboardRecentConversations.vue'

const ds = useDashboardStore() // 仪表盘 store 实例

// 页面挂载后拉取仪表盘数据
onMounted(() => {
  ds.fetchSummary() // 发送 dashboard.summary 请求
})
</script>

<style scoped>
/* 仪表盘页面容器 */
.dashboard {
  padding: 36px 40px; /* 内部间距 */
  height: 100%; /* 填满父容器 */
  overflow-y: auto; /* 内容溢出时纵向滚动 */
}

/* 加载中提示 */
.loading-hint {
  text-align: center; /* 居中 */
  padding: 40px 0; /* 上下间距 */
  font-size: 14px; /* 小号字体 */
}
</style>
