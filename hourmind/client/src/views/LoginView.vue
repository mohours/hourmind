<!--
  LoginView.vue —— 登录页面
  已设置密码后，每次打开 HourMind 看到的页面
  输入密码 → 调 appStore.login() → 后端 bcrypt.compare 验证 → 跳转首页
  和 SetupView 共用 .auth-* 样式类
-->
<template>
  <div class="auth-page">
    <div class="glass-card auth-card">
      <h1 class="auth-logo">HourMind</h1>
      <p class="auth-subtitle">欢迎回来，请输入密码</p>
      <input v-model="pwd" type="password" placeholder="密码" class="auth-input" @keydown.enter="submit" />
      <p v-if="err" class="text-error" style="font-size:13px">{{ err }}</p>
      <button class="btn-primary auth-btn" :disabled="ing" @click="submit">{{ ing?'登录中...':'登录' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'; import { useRouter } from 'vue-router'; import { useAppStore } from '@/stores/appStore'
const r = useRouter(); const a = useAppStore()
const pwd = ref(''); const err = ref(''); const ing = ref(false)
async function submit() {
  err.value = ''; if (!pwd.value) { err.value='请输入密码'; return }
  ing.value = true; try { await a.login(pwd.value); r.push('/') } catch(e:any) { err.value=e.message||'登录失败' } finally { ing.value=false }
}
</script>
<style scoped>
.auth-page { width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#111827 0%,#0A0C12 70%) }
.auth-card { width:400px;padding:40px;display:flex;flex-direction:column;align-items:center;gap:16px }
.auth-logo { font-size:32px;font-weight:700;background:linear-gradient(135deg,#00E5D8,#6366F1);-webkit-background-clip:text;-webkit-text-fill-color:transparent }
.auth-subtitle { color:#94A3B8;font-size:14px }
.auth-input { width:100%;padding:12px 16px }
.auth-btn { width:100%;padding:12px;margin-top:8px }
</style>
