// client/src/router.ts
// 前端路由配置 —— Hash 模式，7 个主页面路由（Setup/Login 由 App.vue 直接渲染）
import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',          name: 'dashboard', component: () => import('@/views/DashboardView.vue') },  // 仪表盘
    { path: '/chat',      name: 'chat',      component: () => import('@/views/ChatView.vue') },       // 对话页面
    { path: '/keys',      name: 'keys',      component: () => import('@/views/KeysView.vue') },       // API Key 管理
    { path: '/tasks',     name: 'tasks',     component: () => import('@/views/TasksView.vue') },      // 待办事项
    { path: '/knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeView.vue') },  // 知识库
    { path: '/history',   name: 'history',   component: () => import('@/views/HistoryView.vue') },    // 历史记录
    { path: '/settings',  name: 'settings',  component: () => import('@/views/SettingsView.vue') },   // 系统设置
  ],
})
