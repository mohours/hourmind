// ============================================================
// appStore.ts —— 全局认证状态管理（Pinia Store）
//
// 这个 Store 管理整个应用的认证状态，是最核心的状态模块。
// 所有页面都依赖它来判断用户是否已登录。
//
// 状态（state）：
//   isAuthenticated  — 用户是否已登录
//   token            — JWT 令牌（存 localStorage，刷新不丢失）
//   isSetupRequired  — 是否需要首次设置密码
//
// 操作（actions）：
//   setup(password)  — 首次设置密码 → 返回 token
//   login(password)  — 登录验证 → 返回 token
//   logout()         — 退出登录 → 清除 token → 刷新页面
//   checkAuth()      — 页面加载时检查 token 是否有效
// ============================================================

// defineStore：Pinia 的核心函数，定义一个状态仓库
import { defineStore } from 'pinia'
// ref：Vue 3 的响应式变量（值变化时自动更新 UI）
import { ref } from 'vue'
// wsClient：WebSocket 客户端单例（所有后端通信都通过它）
import { wsClient } from '@/composables/useWs'

// useAppStore：定义一个名为 'app' 的 Store
// 返回的是一个组合函数，在组件中调用 const app = useAppStore() 来使用
export const useAppStore = defineStore('app', () => {
  // ——— 状态 ———

  // isAuthenticated：是否已登录（响应式，变化时 UI 自动更新）
  const isAuthenticated = ref(false)

  // token：JWT 令牌
  // 初始值从 localStorage 读取（页面刷新后 token 还在）
  const token = ref<string | null>(localStorage.getItem('hourmind_token'))

  // isSetupRequired：是否需要设置密码
  // auth.check 返回 NOT_SETUP 时设为 true
  const isSetupRequired = ref(false)

  // ——— 操作 ———

  // setup(password)：首次设置密码
  // 1. 连接 WebSocket（不带 token，因为还没密码）
  // 2. 调 auth.setup
  // 3. 保存 token → 标记已登录
  async function setup(password: string) {
    // connect('') 不带 token（首次使用，还没有密码哈希）
    await wsClient.connect('')

    // 调后端 auth.setup：存密码哈希 → 返回 JWT Token
    const result = await wsClient.send('auth.setup', { password })

    // 保存 token
    token.value = result.token
    localStorage.setItem('hourmind_token', result.token)

    // 标记已登录
    isAuthenticated.value = true
  }

  // login(password)：登录验证
  // 流程和 setup 一样，但调的是 auth.login
  async function login(password: string) {
    await wsClient.connect('')
    const result = await wsClient.send('auth.login', { password })
    token.value = result.token
    localStorage.setItem('hourmind_token', result.token)
    isAuthenticated.value = true
  }

  // logout()：退出登录
  function logout() {
    // 清除状态
    token.value = null
    isAuthenticated.value = false

    // 清除 localStorage 中的 token
    localStorage.removeItem('hourmind_token')

    // 刷新页面（回到登录页）
    window.location.reload()
  }

  // checkAuth()：页面加载时验证 Token
  // App.vue 在 onMounted 时调用
  //
  // 流程：
  //   1. 没有 token → 先连 WebSocket → 调 auth.check 看是否需要设置密码
  //   2. 有 token   → 用 token 连 WebSocket → 调 auth.check 验证
  //   3. catch → token 无效，清除
  async function checkAuth() {
    // 情况 1：没有 token（首次打开或清除了 localStorage）
    if (!token.value) {
      try {
        // 不带 token 连接
        await wsClient.connect('')
        // 调 auth.check → 返回 NOT_SETUP（需要设置密码）或 TOKEN_REQUIRED（需要登录）
        await wsClient.send('auth.check', {})
        isAuthenticated.value = true
      } catch (e: any) {
        // NOT_SETUP → 前端显示 SetupView（设置密码页面）
        if (e.code === 'NOT_SETUP') {
          isSetupRequired.value = true
        }
        // TOKEN_REQUIRED → 前端显示 LoginView（登录页面）
      }
      return
    }

    // 情况 2：有 token（之前登录过）
    try {
      // 用 token 连接 WebSocket
      await wsClient.connect(token.value)
      // 调 auth.check 验证 token 是否过期
      const r = await wsClient.send('auth.check', {})
      // valid=true → 标记已登录
      if (r.valid) isAuthenticated.value = true
    } catch {
      // token 过期或无效 → 清除
      token.value = null
      localStorage.removeItem('hourmind_token')
    }
  }

  // 返回状态和方法（组件中通过 app.isAuthenticated 等方式访问）
  return { isAuthenticated, isSetupRequired, token, setup, login, logout, checkAuth }
})
