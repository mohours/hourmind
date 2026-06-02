<!-- client/src/views/SetupView.vue -->
<!-- 首次设置密码页面 —— Quantum Glass 玻璃态表单 -->
<template>
  <div class="auth-container">
    <!-- 品牌标题 -->
    <h1 class="auth-title">HourMind</h1>
    <p class="auth-subtitle">小时智脑 · 首次设置</p>

    <!-- 玻璃态表单卡片 -->
    <div class="glass-card" style="width: 400px; padding: 40px 36px">
      <h2 style="margin-bottom: 8px; font-size: 20px">设置主密码</h2>
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px">
        这是您访问 HourMind 的唯一凭证，请妥善保管
      </p>

      <!-- 密码输入 -->
      <input
        v-model="password"
        type="password"
        placeholder="输入密码（至少 6 位）"
        class="auth-input"
        @keyup.enter="handleSetup"
      />
      <!-- 确认密码 -->
      <input
        v-model="confirmPassword"
        type="password"
        placeholder="确认密码"
        class="auth-input"
        @keyup.enter="handleSetup"
      />

      <!-- 错误提示 -->
      <p v-if="error" class="error-text">{{ error }}</p>

      <!-- 提交按钮 -->
      <button
        class="btn-primary"
        style="width: 100%; margin-top: 8px"
        :disabled="loading"
        @click="handleSetup"
      >
        {{ loading ? '设置中...' : '开始使用' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// SetupView 逻辑 —— 验证密码一致性，调用 appStore.setup()
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const appStore = useAppStore()

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function handleSetup() {
  error.value = ''

  // 前端校验
  if (password.value.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  try {
    const res = await appStore.setup(password.value)
    if (res.token) {
      router.replace('/')  // 设置成功，跳转主页
    } else if (res.detail) {
      error.value = res.detail
    }
  } catch {
    error.value = '网络错误，请检查后端是否已启动'
  } finally {
    loading.value = false
  }
}
</script>
