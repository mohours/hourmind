<!--
  AddKeyDialog.vue —— 添加 API Key 弹窗
  玻璃拟态模态框：选择 AI 厂商 → 粘贴 Key → 填别名 → 提交
  提交后 Key 经 AES-256 加密存到后端，前端永远只拿到 keySuffix（后 6 位）
-->
<template>
  <div class="dm" @click.self="$emit('close')">
    <div class="glass-card db">
      <h3>添加新 API Key</h3>
      <label class="lbl">厂商</label>
      <select v-model="pid"><option value="" disabled>选择厂商</option><option v-for="p in ks.providers" :key="p.id" :value="p.id">{{ p.name }}</option></select>
      <label class="lbl">API Key</label>
      <input v-model="kv" type="password" placeholder="粘贴 Key..." />
      <label class="lbl">别名（可选）</label>
      <input v-model="al" placeholder="例如：主力Key" />
      <p v-if="er" class="text-error" style="font-size:13px">{{ er }}</p>
      <div class="bt"><button class="bc" @click="$emit('close')">取消</button><button class="btn-primary" :disabled="sb" @click="sub">{{ sb?'添加中...':'确认' }}</button></div>
    </div>
  </div>
</template>
<script setup lang="ts">

import { ref } from 'vue'; import { useKeyStore } from '@/stores/keyStore'

const emit = defineEmits<{ close:[]; created:[] }>()
const ks = useKeyStore()
const pid = ref(''); const kv = ref(''); const al = ref(''); const er = ref(''); const sb = ref(false)

async function sub() {
  er.value = ''
  if (!pid.value) { er.value='请选择厂商'; return }
  if (!kv.value.trim()) { er.value='请输入Key'; return }
  sb.value = true
  try { await ks.createKey({ providerId:pid.value, keyValue:kv.value.trim(), alias:al.value.trim()||undefined }); emit('created') }
  catch(e:any) { er.value=e.message||'添加失败' }
  finally { sb.value=false }
}

</script>

<style scoped>
.dm { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:1000 }
.db { width:480px; padding:32px; display:flex; flex-direction:column; gap:12px }
.lbl { font-size:13px; color:#94A3B8; font-weight:500 }
.bt { display:flex; gap:12px; justify-content:flex-end; margin-top:12px }
.bc { background:transparent; border:1px solid rgba(148,163,184,0.3); color:#94A3B8; border-radius:10px; padding:10px 20px; cursor:pointer }
.bc:hover { border-color:#F1F5F9; color:#F1F5F9 }
</style>
