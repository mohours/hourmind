// ============================================================
// settingsStore.ts —— 系统设置状态管理（Pinia Store）
//
// 管理系统设置项的读取和保存。
// 设置通过 WebSocket 与后端 AppConfig 表同步。
//
// 设置项：
//   default_model  — 默认 AI 模型（如 "deepseek-v4-pro"）
//   temperature    — 模型温度（0~1，越高越随机）
//   particle_bg    — 粒子背景开关（true/false）
//   glow_intensity — 辉光强度（low/medium/high）
// ============================================================

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wsClient } from '@/composables/useWs'

// AppSettings 类型定义
export interface AppSettings {
  default_model: string    // 默认模型
  temperature: string      // 温度（字符串形式存储）
  particle_bg: string      // 粒子背景
  glow_intensity: string   // 辉光强度
}

export const useSettingsStore = defineStore('settings', () => {
  // ——— 状态 ———

  // settings：所有设置项的当前值（带默认值）
  const settings = ref<AppSettings>({
    default_model: 'deepseek-v4-pro',
    temperature: '0.7',
    particle_bg: 'true',
    glow_intensity: 'medium',
  })

  const loading = ref(false)   // 加载中
  const saving = ref(false)    // 保存中
  const saved = ref(false)     // 保存成功提示（显示 2 秒后自动消失）

  // ——— 操作 ———

  // fetchSettings()：从后端获取设置
  async function fetchSettings() {
    loading.value = true
    try {
      const result = await wsClient.send<AppSettings>('settings.get')
      // 合并：后端返回的值覆盖默认值
      if (result) Object.assign(settings.value, result)
    } finally {
      loading.value = false
    }
  }

  // saveSettings()：保存设置到后端
  async function saveSettings() {
    saving.value = true
    saved.value = false
    try {
      // 把整个 settings 对象发给后端（后端只更新白名单中的 key）
      await wsClient.send('settings.update', { ...settings.value })
      saved.value = true
      // 2 秒后自动隐藏"保存成功"提示
      setTimeout(() => (saved.value = false), 2000)
    } finally {
      saving.value = false
    }
  }

  // resetDefaults()：重置为默认值（仅前端，不保存）
  function resetDefaults() {
    settings.value = {
      default_model: 'deepseek-v4-pro',
      temperature: '0.7',
      particle_bg: 'true',
      glow_intensity: 'medium',
    }
  }

  return {
    settings, loading, saving, saved,
    fetchSettings, saveSettings, resetDefaults,
  }
})
