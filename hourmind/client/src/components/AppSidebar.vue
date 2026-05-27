<!-- AppSidebar.vue —— 左侧导航栏 -->
<template>
  <aside class="sb">
    <div class="logo"><h1>HourMind</h1><span class="sub">小时智脑</span></div>
    <nav class="nav">
      <router-link to="/" class="ni" exact-active-class="na"><span class="ni-icon">📊</span>仪表盘</router-link>
      <router-link to="/chat" class="ni" active-class="na"><span class="ni-icon">💬</span>智能对话</router-link>
      <router-link to="/history" class="ni" active-class="na"><span class="ni-icon">📋</span>历史记录</router-link> <!-- 导航链接：历史记录页面 -->
      <router-link to="/keys" class="ni" active-class="na"><span class="ni-icon">🔑</span>API Key</router-link>
    </nav>
    <div class="ft"><button class="lo" @click="a.logout()">退出登录</button></div>
  </aside>
</template>
<script setup lang="ts">import { useAppStore } from '@/stores/appStore'; const a = useAppStore()</script>
<style scoped>
.sb { width:260px; min-width:260px; height:100vh; background:rgba(16,18,27,0.8); backdrop-filter:blur(20px); border-right:1px solid rgba(0,229,216,0.12); display:flex; flex-direction:column }
.logo { padding:24px 20px; border-bottom:1px solid rgba(0,229,216,0.08) }
.logo h1 { font-size:22px; font-weight:700; background:linear-gradient(135deg,#00E5D8,#6366F1); -webkit-background-clip:text; -webkit-text-fill-color:transparent }
.sub { font-size:12px; color:#64748B; display:block; margin-top:2px }
.nav { flex:1; padding:12px; display:flex; flex-direction:column; gap:4px }
.ni { display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; color:#94A3B8; text-decoration:none; font-size:14px; font-weight:500; transition:all .2s }
.ni:hover { background:rgba(0,229,216,0.08); color:#F1F5F9 }
.na { background:rgba(0,229,216,0.12)!important; color:#00E5D8!important }
.ni-icon { font-size:18px }
.ft { padding:16px; border-top:1px solid rgba(0,229,216,0.08) }
.lo { width:100%; padding:10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#EF4444; border-radius:10px; cursor:pointer; font-size:13px }
.lo:hover { background:rgba(239,68,68,0.2) }
</style>
