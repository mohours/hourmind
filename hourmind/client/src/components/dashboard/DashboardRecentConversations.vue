<!--
 DashboardRecentConversations.vue —— 仪表盘最近对话列表
 横向卡片列表，显示最近 6 条对话，点击跳转到聊天页
-->
<template>
  <div class="recent-section">
    <!-- 区域标题 -->
    <h3 class="section-title">最近对话</h3>

    <!-- 加载中：3 张骨架卡片 -->
    <div v-if="loading" class="recent-row">
      <div v-for="i in 3" :key="i" class="glass-card skeleton-card">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-sub"></div>
      </div>
    </div>

    <!-- 空状态：还没有对话记录 -->
    <div v-else-if="!conversations || conversations.length === 0" class="empty-state">
      <p class="text-muted">还没有对话记录</p>
      <p class="text-muted" style="font-size:13px;margin-top:4px">开始新对话，它会出现在这里</p>
    </div>

    <!-- 对话卡片列表 -->
    <div v-else class="recent-row">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        class="glass-card conv-card"
        @click="goToChat(conv.id)"
      >
        <!-- 对话标题 -->
        <h4 class="conv-title">{{ conv.title }}</h4>
        <!-- 模型名 + 消息数 -->
        <div class="conv-meta">
          <span class="conv-model">{{ conv.model }}</span>
          <span class="conv-count">{{ conv.messageCount }} 条消息</span>
        </div>
        <!-- 最后更新时间 -->
        <span class="conv-time">{{ formatTime(conv.updatedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 路由跳转
import { useRouter } from 'vue-router'
// 对话 store —— 点击卡片后需要选中会话
import { useChatStore } from '@/stores/chatStore'

const router = useRouter() // 路由实例
const chatStore = useChatStore() // 对话状态

// 定义组件 props
defineProps<{
  conversations: {
    id: string
    title: string
    model: string
    updatedAt: string
    messageCount: number
  }[] // 最近对话列表
  loading: boolean // 加载中
}>()

// 格式化相对时间
function formatTime(dateStr: string): string {
  const now = Date.now() // 当前时间戳
  const then = new Date(dateStr).getTime() // 会话更新时间戳
  const diff = Math.floor((now - then) / 1000) // 相差秒数

  if (diff < 60) return '刚刚' // 不到 1 分钟
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前` // 不到 1 小时
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前` // 不到 1 天
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前` // 不到 1 周
  // 超过一周显示日期
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// 点击对话卡片 → 选中会话 → 跳转聊天页
async function goToChat(id: string) {
  await chatStore.selectConversation(id) // 加载消息历史
  router.push('/chat') // 跳转
}
</script>

<style scoped>
/* 区域容器 */
.recent-section {
  margin-bottom: 28px; /* 底部间距 */
}

/* 区域标题 */
.section-title {
  font-size: 16px; /* 中号字体 */
  font-weight: 600; /* 半粗体 */
  color: #F1F5F9; /* 浅色 */
  margin-bottom: 14px; /* 与列表的间距 */
}

/* 对话卡片行：横向滚动 */
.recent-row {
  display: flex; /* Flex 布局 */
  gap: 14px; /* 卡片间距 */
  overflow-x: auto; /* 超出时横向滚动 */
  padding-bottom: 4px; /* 底部留白（给滚动条） */
}

/* 对话卡片 */
.conv-card {
  min-width: 200px; /* 最小宽度（确保至少 200px） */
  max-width: 220px; /* 最大宽度 */
  padding: 18px 20px; /* 内部间距 */
  display: flex; /* Flex 列布局 */
  flex-direction: column; /* 纵向排列 */
  gap: 8px; /* 元素间距 */
  cursor: pointer; /* 手型光标 */
  flex-shrink: 0; /* 不缩小 */
}

/* 对话标题：单行省略 */
.conv-title {
  font-size: 14px; /* 小号字体 */
  font-weight: 600; /* 半粗体 */
  color: #F1F5F9; /* 浅色 */
  white-space: nowrap; /* 不换行 */
  overflow: hidden; /* 溢出隐藏 */
  text-overflow: ellipsis; /* 省略号 */
}

/* 元数据行（模型+消息数） */
.conv-meta {
  display: flex; /* Flex */
  justify-content: space-between; /* 两端对齐 */
  font-size: 12px; /* 极小字体 */
}

/* 模型名 */
.conv-model {
  color: #00E5D8; /* 量子青 */
}

/* 消息数 */
.conv-count {
  color: #64748B; /* 石板灰 */
}

/* 时间 */
.conv-time {
  font-size: 11px; /* 极小字体 */
  color: #475569; /* 深灰 */
}

/* 空状态 */
.empty-state {
  text-align: center; /* 居中 */
  padding: 32px 0; /* 上下间距 */
}

/* 骨架卡片 */
.skeleton-card {
  min-width: 200px; /* 最小宽度 */
  height: 100px; /* 固定高度 */
  padding: 18px 20px; /* 内部间距 */
  display: flex; /* Flex 列 */
  flex-direction: column; /* 纵向 */
  gap: 12px; /* 间距 */
}

/* 骨架线条 */
.skeleton-line {
  background: rgba(255, 255, 255, 0.06); /* 极淡背景 */
  border-radius: 6px; /* 圆角 */
}

/* 标题骨架：短一些 */
.skeleton-title {
  width: 70%; /* 70% 宽度 */
  height: 16px; /* 高度 */
}

/* 副标题骨架：更短 */
.skeleton-sub {
  width: 50%; /* 50% 宽度 */
  height: 12px; /* 高度 */
}
</style>
