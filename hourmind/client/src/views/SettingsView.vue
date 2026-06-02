<!-- client/src/views/SettingsView.vue -->
<!-- 设置页面 —— 标签页导航：AI 模型、外观、数据、关于 -->
<template>
  <div class="settings-page" style="padding: 40px; max-width: 800px; margin: 0 auto;">
    <!-- 页面标题 -->
    <h2 style="font-size: 28px; margin-bottom: 32px;">设置</h2>

    <!-- 标签页导航 -->
    <div style="display: flex; gap: 4px; margin-bottom: 32px; border-bottom: 1px solid var(--border-glow); padding-bottom: 0;">
      <button v-for="tab in tabs" :key="tab.key"
              @click="activeTab = tab.key"
              :style="{
                padding: '10px 24px', fontSize: '15px', background: 'transparent', border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', marginBottom: '-1px',
              }">
        {{ tab.label }}
      </button>
    </div>

    <!-- 加载状态 -->
    <p v-if="settingsStore.loading" style="color: var(--text-secondary); text-align: center; padding: 40px;">加载中...</p>

    <!-- ===== AI 模型设置 ===== -->
    <div v-if="activeTab === 'ai' && !settingsStore.loading" class="glass-card" style="padding: 28px;">
      <h3 style="font-size: 18px; margin-bottom: 20px;">AI 模型</h3>

      <!-- 默认模型 -->
      <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">默认模型</label>
      <select v-model="localSettings.ai_default_model" class="auth-input" style="margin-bottom: 20px;">
        <option value="gpt-4o">GPT-4o</option>
        <option value="gpt-4o-mini">GPT-4o Mini</option>
        <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
        <option value="deepseek-chat">DeepSeek Chat</option>
        <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
        <option value="grok-2-1212">Grok 2</option>
      </select>

      <!-- 温度滑动条 -->
      <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">
        温度: {{ localSettings.ai_temperature }}
      </label>
      <input v-model.number="localSettings.ai_temperature" type="range" min="0" max="2" step="0.1"
             style="width: 100%; margin-bottom: 20px; accent-color: var(--accent);" />

      <!-- 最大 Token -->
      <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">最大 Token 数</label>
      <input v-model.number="localSettings.ai_max_tokens" type="number" class="auth-input" style="margin-bottom: 24px;"
             min="256" max="128000" step="256" />

      <!-- 保存按钮 -->
      <button class="btn-primary" :disabled="saving" @click="saveSettings">
        {{ saving ? '保存中...' : '保存设置' }}
      </button>
    </div>

    <!-- ===== 外观设置 ===== -->
    <div v-if="activeTab === 'appearance' && !settingsStore.loading" class="glass-card" style="padding: 28px;">
      <h3 style="font-size: 18px; margin-bottom: 20px;">外观</h3>

      <!-- 主题切换 -->
      <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">主题</label>
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <button @click="localSettings.app_theme = 'dark'"
                :style="themeBtnStyle('dark')">
          深色
        </button>
        <button @click="localSettings.app_theme = 'light'"
                :style="themeBtnStyle('light')">
          浅色
        </button>
      </div>

      <!-- 语言切换 -->
      <label style="display: block; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px;">语言</label>
      <select v-model="localSettings.app_language" class="auth-input" style="margin-bottom: 24px;">
        <option value="zh-CN">简体中文</option>
        <option value="en">English</option>
      </select>

      <!-- 保存按钮 -->
      <button class="btn-primary" :disabled="saving" @click="saveSettings">
        {{ saving ? '保存中...' : '保存设置' }}
      </button>
    </div>

    <!-- ===== 数据管理 ===== -->
    <div v-if="activeTab === 'data' && !settingsStore.loading" class="glass-card" style="padding: 28px;">
      <h3 style="font-size: 18px; margin-bottom: 20px;">数据管理</h3>

      <!-- 导出 JSON -->
      <div style="margin-bottom: 20px;">
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">将所有数据导出为 JSON 文件</p>
        <button class="btn-primary" style="padding: 10px 20px; font-size: 14px;" @click="exportData">
          导出数据
        </button>
      </div>

      <hr style="border: none; border-top: 1px solid var(--border-glow); margin: 20px 0;" />

      <!-- 清空对话 -->
      <div style="margin-bottom: 20px;">
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">清空所有对话记录（不可恢复）</p>
        <button class="btn-danger" style="padding: 10px 20px; font-size: 14px;" @click="clearConversations">
          清空对话
        </button>
      </div>

      <hr style="border: none; border-top: 1px solid var(--border-glow); margin: 20px 0;" />

      <!-- 删除全部数据 -->
      <div>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">删除所有数据（Key、对话、任务、知识库全部清除，不可恢复）</p>
        <button style="background: var(--danger); color: #fff; border: none; border-radius: var(--radius); padding: 10px 20px; font-size: 14px; cursor: pointer;"
                @click="deleteAllData">
          删除全部数据
        </button>
      </div>
    </div>

    <!-- ===== 关于 ===== -->
    <div v-if="activeTab === 'about' && !settingsStore.loading" class="glass-card" style="padding: 28px;">
      <h3 style="font-size: 18px; margin-bottom: 20px;">关于 HourMind</h3>

      <!-- 版本信息 -->
      <div style="margin-bottom: 24px;">
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">版本</p>
        <p style="font-size: 16px; font-weight: 600;">v1.0.0</p>
      </div>

      <!-- 技术栈 -->
      <div style="margin-bottom: 24px;">
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">技术栈</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="padding: 4px 12px; background: rgba(0,229,216,0.1); border: 1px solid var(--border-glow); border-radius: 12px; font-size: 13px; color: var(--accent);">
            Vue 3
          </span>
          <span style="padding: 4px 12px; background: rgba(96,165,250,0.1); border: 1px solid var(--border-glow); border-radius: 12px; font-size: 13px; color: #60A5FA;">
            TypeScript
          </span>
          <span style="padding: 4px 12px; background: rgba(196,181,253,0.1); border: 1px solid var(--border-glow); border-radius: 12px; font-size: 13px; color: var(--accent-purple);">
            Vite
          </span>
          <span style="padding: 4px 12px; background: rgba(251,146,60,0.1); border: 1px solid var(--border-glow); border-radius: 12px; font-size: 13px; color: #FB923C;">
            Pinia
          </span>
          <span style="padding: 4px 12px; background: rgba(52,211,153,0.1); border: 1px solid var(--border-glow); border-radius: 12px; font-size: 13px; color: var(--success);">
            Node.js
          </span>
          <span style="padding: 4px 12px; background: rgba(148,163,184,0.1); border: 1px solid var(--border-glow); border-radius: 12px; font-size: 13px; color: var(--text-secondary);">
            Express
          </span>
          <span style="padding: 4px 12px; background: rgba(96,165,250,0.1); border: 1px solid var(--border-glow); border-radius: 12px; font-size: 13px; color: #60A5FA;">
            Prisma
          </span>
          <span style="padding: 4px 12px; background: rgba(239,68,68,0.1); border: 1px solid var(--border-glow); border-radius: 12px; font-size: 13px; color: var(--danger);">
            SQLite
          </span>
        </div>
      </div>

      <!-- 描述 -->
      <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
        HourMind（小时智脑）是一个个人智能系统，定位为"私人第二大脑 + 多模型 AI 助理"。
        支持多厂商 API Key 统一管理、流式对话、知识库、待办事项等功能。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// SettingsView 逻辑 —— 标签页导航、设置表单、数据管理操作
import { ref, reactive, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAppStore } from '@/stores/appStore'
import { api } from '@/api'

const settingsStore = useSettingsStore()  // 设置 store
const appStore = useAppStore()            // 认证 store

// 标签页定义
const tabs = [
  { key: 'ai', label: 'AI 模型' },      // AI 模型设置
  { key: 'appearance', label: '外观' },   // 主题和语言
  { key: 'data', label: '数据' },          // 数据管理
  { key: 'about', label: '关于' },        // 应用信息
]
const activeTab = ref('ai')  // 当前激活标签页

// 本地设置副本（用于绑定表单，不直接修改 store 中的值）
const localSettings = reactive({
  ai_default_model: 'gpt-4o',
  ai_temperature: 0.7,
  ai_max_tokens: 4096,
  app_theme: 'dark',
  app_language: 'zh-CN',
})

// 保存加载状态
const saving = ref(false)

// 组件挂载时加载设置
onMounted(async () => {
  await settingsStore.fetchSettings()
  // 同步到本地副本
  syncFromStore()
})

/** 将 store 中的设置同步到本地表单副本 */
function syncFromStore() {
  localSettings.ai_default_model = settingsStore.settings.ai_default_model
  localSettings.ai_temperature = settingsStore.settings.ai_temperature
  localSettings.ai_max_tokens = settingsStore.settings.ai_max_tokens
  localSettings.app_theme = settingsStore.settings.app_theme
  localSettings.app_language = settingsStore.settings.app_language
}

/** 保存设置到后端 */
async function saveSettings() {
  saving.value = true
  try {
    // 将所有本地设置提交到后端
    await settingsStore.updateSettings({
      ai_default_model: localSettings.ai_default_model,
      ai_temperature: localSettings.ai_temperature,
      ai_max_tokens: localSettings.ai_max_tokens,
      app_theme: localSettings.app_theme,
      app_language: localSettings.app_language,
    })
  } catch {
    console.warn('保存设置失败')
  } finally {
    saving.value = false
  }
}

/** 主题按钮样式 */
function themeBtnStyle(theme: string) {
  const isActive = localSettings.app_theme === theme  // 是否选中
  return {
    padding: '10px 24px', fontSize: '14px', borderRadius: '12px', cursor: 'pointer',
    border: isActive ? '2px solid var(--accent)' : '1px solid var(--border-glow)',
    background: isActive ? 'rgba(0,229,216,0.1)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
  }
}

/** 导出数据为 JSON 文件 */
async function exportData() {
  try {
    const data = await api('GET', '/export', undefined, appStore.token)
    // 将数据序列化为 JSON 字符串
    const jsonStr = JSON.stringify(data, null, 2)
    // 创建 Blob 对象
    const blob = new Blob([jsonStr], { type: 'application/json' })
    // 生成下载 URL
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')  // 创建临时下载元素
    a.href = url
    a.download = `hourmind-export-${new Date().toISOString().slice(0, 10)}.json`  // 文件名含日期
    a.click()  // 触发下载
    URL.revokeObjectURL(url)  // 释放内存
  } catch {
    alert('导出失败')
  }
}

/** 清空所有对话 */
async function clearConversations() {
  if (!confirm('确定清空所有对话记录？此操作不可恢复。')) return
  try {
    await api('DELETE', '/conversations', undefined, appStore.token)
    alert('对话已清空')
  } catch {
    alert('操作失败')
  }
}

/** 删除全部数据 */
async function deleteAllData() {
  if (!confirm('确定删除全部数据（Key、对话、任务、知识库）？此操作完全不可恢复！')) return
  if (!confirm('再次确认：所有数据将永久删除。')) return  // 二次确认
  try {
    await api('DELETE', '/data/all', undefined, appStore.token)
    alert('所有数据已删除，即将刷新页面')
    window.location.reload()  // 刷新页面回到初始状态
  } catch {
    alert('操作失败')
  }
}
</script>
