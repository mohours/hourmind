<!-- SetupView.vue —— 首次设置密码 -->
<template>
  <div class="auth-page">
    <div class="glass-card auth-card">
      <h1 class="auth-logo">HourMind</h1>
      <p class="auth-subtitle">设置你的专属密码</p>
      <input v-model="pwd" type="password" placeholder="密码（至少4位）" class="auth-input" @keydown.enter="submit" />
      <input v-model="pwd2" type="password" placeholder="再次输入密码" class="auth-input" @keydown.enter="submit" />
      <p v-if="err" class="text-error" style="font-size:13px">{{ err }}</p>
      <button class="btn-primary auth-btn" :disabled="ing" @click="submit">{{ ing ? '设置中...' : '开始使用' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'; import { useRouter } from 'vue-router'; import { useAppStore } from '@/stores/appStore'
const r = useRouter(); const a = useAppStore()
const pwd = ref(''); const pwd2 = ref(''); const err = ref(''); const ing = ref(false)
async function submit() {
  err.value = ''
  if (!pwd.value) { err.value='请输入密码'; return }
  if (pwd.value.length<4) { err.value='密码至少4位'; return }
  if (pwd.value!==pwd2.value) { err.value='两次密码不一致'; return }
  ing.value=true; try { await a.setup(pwd.value); r.push('/') } catch(e:any) { err.value=e.message||'设置失败' } finally { ing.value=false }
}
</script>

<style scoped>
.auth-page { width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; background:radial-gradient(ellipse at center,#111827 0%,#0A0C12 70%) }
.auth-card { width:400px; padding:40px; display:flex; flex-direction:column; align-items:center; gap:16px }
.auth-logo { font-size:32px; font-weight:700; background:linear-gradient(135deg,#00E5D8,#6366F1); -webkit-background-clip:text; -webkit-text-fill-color:transparent }
.auth-subtitle { color:#94A3B8; font-size:14px }
.auth-input { width:100%; padding:12px 16px }
.auth-btn { width:100%; padding:12px; margin-top:8px }
</style>
