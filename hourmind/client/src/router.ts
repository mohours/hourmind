// ============================================================
// router.ts —— Vue Router 前端路由配置
//
// 路由 = URL 路径和页面组件的映射关系
// 例如用户访问 /#/keys → 路由器加载 KeysView.vue 显示
//
// createWebHashHistory() 使用 Hash 模式（URL 带 # 号）
// 例如 http://localhost:5173/#/keys
// 为什么用 Hash 模式？不需要服务端配置，刷新页面不会 404
// ============================================================

// createRouter：创建路由实例
// createWebHashHistory：Hash 模式（URL 中用 # 分隔路径）
import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  // Hash 模式：URL 格式为 /#/路径
  // History 模式（不用 #）需要服务端配合，Hash 模式更简单
  history: createWebHashHistory(),

  // routes 数组：定义 URL 路径 → 组件的映射
  // 每个路由的配置：
  //   path     — URL 路径
  //   name     — 路由名称（代码中 router.push({ name: 'chat' }) 跳转用）
  //   component — 对应的 Vue 组件（() => import() 是懒加载，用到时才加载）
  routes: [
    // 未认证时的页面（无导航栏）
    { path: '/setup', name: 'setup', component: () => import('@/views/SetupView.vue') },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },

    // 认证后的页面（有侧边栏导航）
    { path: '/keys', name: 'keys', component: () => import('@/views/KeysView.vue') },
    { path: '/chat', name: 'chat', component: () => import('@/views/ChatView.vue') },
    { path: '/history', name: 'history', component: () => import('@/views/HistoryView.vue') },
    { path: '/tasks', name: 'tasks', component: () => import('@/views/TasksView.vue') },
    { path: '/knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
  ],
})
