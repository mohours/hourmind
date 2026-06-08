<!-- client/src/views/LoginView.vue -->
<!-- 登录页面 —— OAuth 优先，密码为备选 -->
<template>
  <div class="auth-container">
    <!-- 品牌标题 -->
    <h1 class="auth-title">HourMind</h1>
    <p class="auth-subtitle">小时智脑</p>

    <!-- 玻璃态表单卡片 -->
    <div class="glass-card" style="width: 400px; padding: 40px 36px">

      <!-- GitHub OAuth 登录按钮（主要入口） -->
      <button
        v-for="p in providers"
        :key="p.id"
        class="btn-oauth"
        :disabled="oauthLoading"
        @click="handleOAuthLogin(p.id)"
      >
        <!-- GitHub 猫头鹰图标（内联 SVG） -->
        <svg v-if="p.icon === 'github'" class="oauth-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        <span>{{ oauthLoading ? '正在跳转...' : `使用 ${p.name} 登录` }}</span>
      </button>

      <!-- 分隔线 —— "或" -->
      <div class="divider">
        <span class="divider-text">或</span>
      </div>

      <!-- 密码登录（默认折叠） -->
      <button v-if="!showPassword" class="btn-link" @click="showPassword = true">
        使用密码登录
      </button>

      <template v-if="showPassword">
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
          {{ loading ? '验证中...' : '密码登录' }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// LoginView 逻辑 —— OAuth 优先 + 密码备选
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const appStore = useAppStore()

// OAuth 相关状态
const providers = ref<Array<{id: string; name: string; icon: string}>>([])  // 可用 Provider 列表
const oauthLoading = ref(false)  // OAuth 跳转加载状态
// 密码登录相关状态
const showPassword = ref(false)  // 是否展开密码登录
const password = ref('')
const error = ref('')
const loading = ref(false)

// 页面加载时获取可用 Provider 列表
onMounted(async () => {
  try {
    providers.value = await appStore.getOAuthProviders()
  } catch {
    // 后端不可用时忽略，用户仍可通过密码登录
  }
})

/** OAuth 登录——获取授权 URL 后跳转 */
async function handleOAuthLogin(providerId: string) {
  oauthLoading.value = true
  try {
    const url = await appStore.getOAuthLoginUrl(providerId)
    window.location.href = url  // 跳转到 GitHub 授权页
  } catch {
    oauthLoading.value = false
    error.value = '获取授权链接失败，请检查后端是否已启动'
  }
}

/** 密码登录 */
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
