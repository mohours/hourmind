// settingsStore.ts —— 系统设置状态管理
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wsClient } from '@/composables/useWs'

// 设置项类型
export interface AppSettings {
  default_model: string // 默认 AI 模型
  temperature: string // 模型温度（0~1）
  particle_bg: string // 粒子背景开关
  glow_intensity: string // 辉光强度
}

export const useSettingsStore = defineStore('settings', () => {
  // 当前设置
  const settings = ref<AppSettings>({
    default_model: 'deepseek-v4-pro',
    temperature: '0.7',
    particle_bg: 'true',
    glow_intensity: 'medium',
  })
  // 加载状态
  const loading = ref(false)
  // 保存状态
  const saving = ref(false)
  // 保存成功提示
  const saved = ref(false)

  // 拉取设置
  async function fetchSettings() {
    loading.value = true
    try {
      const result = await wsClient.send<AppSettings>('settings.get')
      // 合并：后端返回的覆盖默认值
      if (result) Object.assign(settings.value, result)
    } finally {
      loading.value = false
    }
  }

  // 保存设置（批量更新）
  async function saveSettings() {
    saving.value = true
    saved.value = false
    try {
      await wsClient.send('settings.update', { ...settings.value })
      saved.value = true // 显示保存成功
      setTimeout(() => (saved.value = false), 2000) // 2 秒后隐藏
    } finally {
      saving.value = false
    }
  }

  // 重置为默认值
  function resetDefaults() {
    settings.value = {
      default_model: 'deepseek-v4-pro',
      temperature: '0.7',
      particle_bg: 'true',
      glow_intensity: 'medium',
    }
  }

  return { settings, loading, saving, saved, fetchSettings, saveSettings, resetDefaults }
})
