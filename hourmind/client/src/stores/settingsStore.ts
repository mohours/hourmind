// client/src/stores/settingsStore.ts
// 设置状态管理 —— 系统设置的读取与更新
import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/appStore'

// 系统设置接口
export interface AppSettings {
  ai_default_model: string      // 默认 AI 模型
  ai_temperature: number        // AI 温度参数 (0-2)
  ai_max_tokens: number         // AI 最大 Token 数
  app_theme: string             // 主题: dark / light
  app_language: string          // 语言: zh-CN / en
}

export const useSettingsStore = defineStore('settings', () => {
  // 设置对象（含默认值）
  const settings = reactive<AppSettings>({
    ai_default_model: 'gpt-4o',     // 默认模型
    ai_temperature: 0.7,            // 默认温度
    ai_max_tokens: 4096,           // 默认最大 Token
    app_theme: 'dark',              // 默认深色主题
    app_language: 'zh-CN',          // 默认中文
  })

  // 加载状态
  const loading = ref(false)

  // 获取认证 token
  function token() { return useAppStore().token }

  /** 从后端加载设置 */
  async function fetchSettings() {
    loading.value = true
    try {
      const data = await api('GET', '/settings', undefined, token())
      if (data) {
        // 逐字段回填，保留默认值兜底
        if (data.ai_default_model !== undefined) settings.ai_default_model = data.ai_default_model
        if (data.ai_temperature !== undefined) settings.ai_temperature = data.ai_temperature
        if (data.ai_max_tokens !== undefined) settings.ai_max_tokens = data.ai_max_tokens
        if (data.app_theme !== undefined) settings.app_theme = data.app_theme
        if (data.app_language !== undefined) settings.app_language = data.app_language
      }
    } catch {
      console.warn('加载设置失败，使用默认值')
    } finally {
      loading.value = false
    }
  }

  /** 更新设置到后端 */
  async function updateSettings(fields: Partial<AppSettings>) {
    const data = await api('PUT', '/settings', fields, token())
    if (data) {
      // 更新本地响应式对象
      Object.assign(settings, fields)
    }
    return data
  }

  return {
    settings,
    loading,
    fetchSettings,
    updateSettings,
  }
})
