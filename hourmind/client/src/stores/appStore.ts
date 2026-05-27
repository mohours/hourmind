// appStore.ts —— 全局状态：登录/Token/侧边栏
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wsClient } from '@/composables/useWs'

export const useAppStore = defineStore('app', () => {
  const isAuthenticated = ref(false)
  const token = ref<string | null>(localStorage.getItem('hourmind_token'))
  const isSetupRequired = ref(false)

  async function setup(password: string) {
    await wsClient.connect('')
    const result = await wsClient.send('auth.setup', { password })
    token.value = result.token
    localStorage.setItem('hourmind_token', result.token)
    isAuthenticated.value = true
  }

  async function login(password: string) {
    await wsClient.connect('')
    const result = await wsClient.send('auth.login', { password })
    token.value = result.token
    localStorage.setItem('hourmind_token', result.token)
    isAuthenticated.value = true
  }

  function logout() {
    token.value = null; isAuthenticated.value = false
    localStorage.removeItem('hourmind_token')
    window.location.reload()
  }

  async function checkAuth() {
    if (!token.value) {
      try { await wsClient.connect(''); await wsClient.send('auth.check', {}); isAuthenticated.value = true }
      catch (e: any) { if (e.code === 'NOT_SETUP') isSetupRequired.value = true }
      return
    }
    try { await wsClient.connect(token.value); const r = await wsClient.send('auth.check', {}); if (r.valid) isAuthenticated.value = true }
    catch { token.value = null; localStorage.removeItem('hourmind_token') }
  }

  return { isAuthenticated, isSetupRequired, token, setup, login, logout, checkAuth }
})
