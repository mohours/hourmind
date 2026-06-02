<!-- client/src/views/LoginView.vue -->
<!-- 登录页面 —— Quantum Glass 玻璃态表单 -->
<template>
  <div class="auth-container">
    <!-- 品牌标题 -->
    <h1 class="auth-title">HourMind</h1>
    <p class="auth-subtitle">小时智脑</p>

    <!-- 玻璃态表单卡片 -->
    <div class="glass-card" style="width: 400px; padding: 40px 36px">
      <h2 style="margin-bottom: 24px; font-size: 20px">登录</h2>

      <!-- 密码输入 -->
      <input
        v-model="password"
        type="password"
        placeholder="请输入主密码"
        class="auth-input"
        @keyup.enter="handleLogin"
      />

      <!-- 错误提示 -->
      <p v-if="error" class="error-text">{{ error }}</p>

      <!-- 登录按钮 -->
      <button
        class="btn-primary"
        style="width: 100%; margin-top: 8px"
        :disabled="loading"
        @click="handleLogin"
      >
        {{ loading ? '验证中...' : '进入' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// LoginView 逻辑 —— 调用 appStore.login()，成功后跳转首页
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const appStore = useAppStore()

const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  if (!password.value) {
    error.value = '请输入密码'
    return
  }

  loading.value = true
  try {
    const res = await appStore.login(password.value)
    if (res.token) {
      router.replace('/')  // 登录成功，跳转主页
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
