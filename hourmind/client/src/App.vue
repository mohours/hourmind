<!-- App.vue —— 根组件：未认证显示登录页，已认证显示侧边栏+内容 -->
<template>
  <div v-if="!app.isAuthenticated" style="width:100vw;height:100vh"><router-view /></div>
  <div v-else class="app-layout">
    <AppSidebar />
    <main class="main-content"><router-view /></main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import AppSidebar from '@/components/AppSidebar.vue'

const app = useAppStore()
const route = useRoute()
const router = useRouter()

// 页面加载时检查登录状态
onMounted(async () => {
  await app.checkAuth()
  if (app.isSetupRequired && route.path !== '/setup') router.push('/setup')
  else if (!app.isAuthenticated && route.path !== '/login') router.push('/login')
})
</script>

<style scoped>
.app-layout { display: flex; width: 100vw; height: 100vh; }
.main-content { flex: 1; overflow: hidden; background: #0A0C12; }
</style>
