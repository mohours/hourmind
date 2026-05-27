<!--
 DashboardQuickEntry.vue —— 仪表盘快速入口卡片
 4 个大玻璃卡片：新对话 / API Key / 知识库 / 待办事项
 已实现的功能跳转路由，未实现的显示"即将推出"
-->
<template>
  <!-- 快速入口行 -->
  <div class="quick-entry-row">
    <!-- v-for 循环渲染 4 张入口卡片 -->
    <div
      v-for="entry in entries"
      :key="entry.label"
      class="glass-card entry-card"
      :class="{ 'entry-disabled': entry.disabled }"
      @click="handleClick(entry)"
    >
      <!-- 图标 -->
      <span class="entry-icon">{{ entry.icon }}</span>
      <!-- 标题 -->
      <span class="entry-label">{{ entry.label }}</span>
      <!-- 未实现的功能显示提示 -->
      <span v-if="entry.disabled" class="entry-badge">即将推出</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 路由跳转
import { useRouter } from 'vue-router'
// 对话 store
import { useChatStore } from '@/stores/chatStore'

const router = useRouter() // 路由实例
const chatStore = useChatStore() // 对话状态

// 4 个快速入口定义
const entries = [
  { label: '新对话', icon: '💬', route: '/chat', disabled: false }, // 已实现
  { label: 'API Key', icon: '🔑', route: '/keys', disabled: false }, // 已实现
  { label: '知识库', icon: '📚', route: '/knowledge', disabled: true }, // 未实现
  { label: '待办事项', icon: '✅', route: '/tasks', disabled: true }, // 未实现
]

// 处理点击
async function handleClick(entry: (typeof entries)[0]) {
  if (entry.disabled) return // 未实现的功能不响应点击
  // 新对话需要先创建会话
  if (entry.route === '/chat') {
    await chatStore.createConversation()
  }
  router.push(entry.route) // 跳转路由
}
</script>

<style scoped>
/* 快速入口行：横向 Flex */
.quick-entry-row {
  display: flex; /* Flex 布局 */
  gap: 16px; /* 间距 */
  margin-bottom: 28px; /* 底部间距 */
}

/* 每张入口卡片 */
.entry-card {
  flex: 1; /* 等分空间 */
  height: 100px; /* 固定高度 */
  display: flex; /* Flex 列布局 */
  flex-direction: column; /* 纵向排列 */
  align-items: center; /* 水平居中 */
  justify-content: center; /* 垂直居中 */
  gap: 8px; /* 间距 */
  cursor: pointer; /* 手型光标 */
  text-decoration: none; /* 去掉下划线 */
  color: #F1F5F9; /* 浅色文字 */
  transition: all 0.3s ease; /* 过渡动画 */
  position: relative; /* 相对定位（为徽章定位） */
}

/* 未实现功能的卡片 */
.entry-disabled {
  opacity: 0.5; /* 半透明 */
  cursor: not-allowed; /* 禁用光标 */
}
.entry-disabled:hover {
  transform: none !important; /* 禁止上浮 */
  border-color: rgba(0, 229, 216, 0.18) !important; /* 禁止辉光 */
}

/* 图标 */
.entry-icon {
  font-size: 28px; /* 大图标 */
}

/* 标题 */
.entry-label {
  font-size: 14px; /* 较小字号 */
  font-weight: 500; /* 中等粗细 */
}

/* "即将推出"徽章 */
.entry-badge {
  position: absolute; /* 绝对定位 */
  top: 10px; /* 距顶部 */
  right: 10px; /* 距右侧 */
  font-size: 10px; /* 极小字体 */
  color: #00E5D8; /* 量子青 */
  background: rgba(0, 229, 216, 0.1); /* 量子青半透明背景 */
  padding: 2px 8px; /* 内部间距 */
  border-radius: 8px; /* 圆角 */
  border: 1px solid rgba(0, 229, 216, 0.25); /* 量子青边框 */
}
</style>
