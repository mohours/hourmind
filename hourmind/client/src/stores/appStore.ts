// client/src/stores/appStore.ts
// 认证状态管理 —— token 持久化到 localStorage，登录/登出/检查
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export const useAppStore = defineStore('app', () => {
  // token 持久化 —— 从 localStorage 恢复
  const token = ref(localStorage.getItem('hourmind_token') || '')
  const isAuthenticated = ref(false)
  const isSetupRequired = ref(false)

  /** 检查当前 token 是否有效 */
  async function checkAuth() {
    if (!token.value) {
      isAuthenticated.value = false
      // 发一个不带 token 的 check 请求，看看是否需要 setup
      try {
        const res = await fetch('/api/auth/status')
        const data = await res.json()
        isSetupRequired.value = !!data.setup_required
      } catch {
        isSetupRequired.value = false
      }
      return
    }
    try {
      const data = await api('GET', '/auth/check', undefined, token.value)
      isAuthenticated.value = data.valid
      isSetupRequired.value = data.setup_required
    } catch {
      // Token 无效，清除并重新检查 setup 状态
      isAuthenticated.value = false
      token.value = ''
      localStorage.removeItem('hourmind_token')
      try {
        const res = await fetch('/api/auth/status')
        const data = await res.json()
        isSetupRequired.value = !!data.setup_required
      } catch {
        isSetupRequired.value = false
      }
    }
  }

  /** 首次设置密码 */
  async function setup(password: string) {
    const data = await api('POST', '/auth/setup', { password })
    if (data.token) {
      token.value = data.token
      localStorage.setItem('hourmind_token', data.token)
      isAuthenticated.value = true
      isSetupRequired.value = false
    }
    return data
  }

  /** 密码登录 */
  async function login(password: string) {
    const data = await api('POST', '/auth/login', { password })
    if (data.token) {
      token.value = data.token
      localStorage.setItem('hourmind_token', data.token)
      isAuthenticated.value = true
      isSetupRequired.value = false
    }
    return data
  }

  /** 登出 —— 清除 token 并刷新页面 */
  function logout() {
    token.value = ''
    isAuthenticated.value = false
    localStorage.removeItem('hourmind_token')
    window.location.reload()
  }

  return { token, isAuthenticated, isSetupRequired, checkAuth, setup, login, logout }
})
