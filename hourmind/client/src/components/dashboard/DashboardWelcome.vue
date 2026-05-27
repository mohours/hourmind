<!--
 DashboardWelcome.vue —— 仪表盘顶部欢迎栏
 动态问候语（根据时段变化）+ 日期 + 开始新对话按钮
-->
<template>
  <div class="welcome">
    <!-- 左侧：欢迎语 + 日期 -->
    <div class="welcome-text">
      <h1 class="greeting">{{ greeting }}</h1>
      <p class="date">{{ dateStr }}</p>
    </div>
    <!-- 右侧：新对话按钮 -->
    <button class="btn-primary new-chat-btn" @click="startNewChat">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      开始新对话
    </button>
  </div>
</template>

<script setup lang="ts">
// 计算属性 —— 从 Vue 导入
import { computed } from 'vue'
// 路由跳转
import { useRouter } from 'vue-router'
// 对话 store —— 用于创建新会话
import { useChatStore } from '@/stores/chatStore'

const router = useRouter() // 路由实例
const chatStore = useChatStore() // 对话状态

// 动态问候：根据当前小时切换文案
const greeting = computed(() => {
  const h = new Date().getHours() // 当前小时（0-23）
  if (h < 6) return '夜深了，注意休息' // 凌晨 0-5 点
  if (h < 12) return '早上好' // 上午 6-11 点
  if (h < 14) return '中午好' // 中午 12-13 点
  if (h < 18) return '下午好' // 下午 14-17 点
  return '晚上好' // 晚上 18-23 点
})

// 格式化日期：如 "2026年5月27日 星期三"
const dateStr = computed(() => {
  const d = new Date() // 当前日期
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`
})

// 点击"开始新对话" → 创建会话 → 跳转到聊天页
async function startNewChat() {
  await chatStore.createConversation() // 后端创建 + 设为 activeId
  router.push('/chat') // 跳转到对话页
}
</script>

<style scoped>
/* 欢迎栏容器：左右分布 */
.welcome {
  display: flex; /* Flex 布局 */
  justify-content: space-between; /* 左右两端对齐 */
  align-items: center; /* 垂直居中 */
  margin-bottom: 28px; /* 底部间距 */
}

/* 问候语：大号渐变文字 */
.greeting {
  font-size: 28px; /* 大标题 */
  font-weight: 700; /* 粗体 */
  background: linear-gradient(135deg, #F1F5F9, #00E5D8); /* 渐变：白→量子青 */
  -webkit-background-clip: text; /* 文字裁剪（WebKit） */
  -webkit-text-fill-color: transparent; /* 文字透明显示渐变 */
  background-clip: text; /* 标准属性 */
}

/* 日期：灰色小字 */
.date {
  color: #64748B; /* 石板灰 */
  font-size: 14px; /* 小号字体 */
  margin-top: 6px; /* 与标题的间距 */
}

/* 新对话按钮 */
.new-chat-btn {
  display: flex; /* Flex 让图标和文字并排 */
  align-items: center; /* 垂直居中 */
  gap: 8px; /* 图标和文字间距 */
  padding: 14px 28px; /* 加大按钮 */
  font-size: 15px; /* 字体大小 */
  border-radius: 14px; /* 圆角 */
}
</style>
