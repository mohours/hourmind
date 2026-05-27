// router.ts —— 前端路由：URL ↔ 页面组件的映射
import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),  // URL 格式：/#/login
  routes: [
    { path: '/setup', name: 'setup', component: () => import('@/views/SetupView.vue') },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    { path: '/keys', name: 'keys', component: () => import('@/views/KeysView.vue') },
    { path: '/chat', name: 'chat', component: () => import('@/views/ChatView.vue') },
    { path: '/history', name: 'history', component: () => import('@/views/HistoryView.vue') }, // 历史记录页
    { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
  ],
})
