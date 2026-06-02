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
import { onMounted } from 'vue'
import SetupView from '@/views/SetupView.vue'
import LoginView from '@/views/LoginView.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()

// 页面加载时检查 token 有效性
onMounted(async () => {
  await store.checkAuth()
})
</script>

<style>
.main-content {
  margin-left: 260px; /* 给侧边栏留空 */
  min-height: 100vh;
}
</style>
