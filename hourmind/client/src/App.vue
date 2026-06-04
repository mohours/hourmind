<!-- client/src/App.vue -->
<!-- 根组件 —— 根据认证状态分发到 Setup / Login / 主界面 -->
<template>
  <!-- 未初始化 → 显示设置密码页 -->
  <SetupView v-if="!store.isAuthenticated && store.isSetupRequired" />

  <!-- 已初始化但未登录 → 显示登录页 -->
  <LoginView v-else-if="!store.isAuthenticated" />

  <!-- 已认证 → 侧边栏 + 主内容区 -->
  <template v-else>
    <AppSidebar />
    <main class="main-content">
      <router-view />
    </main>
  </template>
</template>

<script setup lang="ts">
// App.vue 逻辑 —— mounted 时检查认证状态
import { onMounted, onUnmounted } from 'vue'
import SetupView from '@/views/SetupView.vue'
import LoginView from '@/views/LoginView.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
let reminderTimer: number | null = null  // 提醒定时器
const remindedTasks = new Set<string>()  // 已提醒去重

/** 检查到期任务 */
async function checkReminders() {
  if (!window.Notification || Notification.permission !== 'granted') return
  try {
    const token = store.token  // 当前 JWT
    if (!token) return
    const res = await fetch('/api/tasks', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const tasks = await res.json()
    if (!Array.isArray(tasks)) return
    const now = Date.now()

    // 优先级对应的提前提醒时间（毫秒）
    const advanceMap: Record<string, number> = {
      low:    2 * 60 * 1000,       // 低优先级：提前 2 分钟
      medium: 2 * 60 * 60 * 1000,  // 中优先级：提前 2 小时
      high:   5 * 60 * 60 * 1000,  // 高优先级：提前 5 小时
      urgent: 5 * 60 * 60 * 1000,  // 紧急：提前 5 小时
    }

    tasks.forEach((task: any) => {
      if (!task.due_date || task.status === 'done') return
      const priority = task.priority || 'medium'  // 默认中优先级
      const advanceMs = advanceMap[priority] || advanceMap.medium  // 取对应时间窗口
      const diff = new Date(task.due_date).getTime() - now
      // 进入提醒窗口且未提醒过
      if (diff > 0 && diff <= advanceMs && !remindedTasks.has(task.id)) {
        remindedTasks.add(task.id)
        const minutes = Math.round(diff / 60000)
        const timeText = minutes >= 60
          ? `还有 ${Math.round(minutes / 60)} 小时 ${minutes % 60} 分钟到期`
          : `还有 ${minutes} 分钟到期`
        new Notification('⏰ 待办提醒', {
          body: `「${task.title}」${timeText}`,
        })
      }
    })
  } catch {}
}

// 页面加载时检查 token 有效性
onMounted(async () => {
  await store.checkAuth()

  // 请求通知权限 + 启动提醒（仅已认证时）
  if (store.isAuthenticated) {
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    checkReminders()  // 立即检查一次
    reminderTimer = window.setInterval(checkReminders, 30000)  // 每 30 秒
  }
})

onUnmounted(() => {
  if (reminderTimer) clearInterval(reminderTimer)
})
</script>

<style>
.main-content {
  margin-left: 260px; /* 给侧边栏留空 */
  min-height: 100vh;
}
</style>
