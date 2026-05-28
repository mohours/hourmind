<!--
  KeyCard.vue —— 单张 API Key 卡片组件
  显示厂商名、别名、Key 后缀（后 6 位）、状态指示灯
  操作按钮：测试连通性、启用/禁用、删除
-->
<template>
  <div class="glass-card kc">
    <div class="ki"><span class="kp">{{ ak.provider.name }}</span><span class="ka">{{ ak.alias }}</span><span class="text-muted" style="font-size:12px;font-family:monospace">...{{ ak.keySuffix }}</span></div>
    <div class="ks"><span :class="['d',dc]"></span>{{ ak.status }}</div>
    <div class="act"><button class="ab" @click.stop="$emit('test')" title="测试">🔄</button><button class="ab" @click.stop="$emit('toggle')" :title="ak.status==='active'?'禁用':'启用'">{{ ak.status==='active'?'⏸':'▶' }}</button><button class="ab db" @click.stop="$emit('delete')" title="删除">🗑</button></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const p = defineProps<{ ak: { id:string; alias:string; keySuffix:string; status:string; provider:{name:string} } }>()
defineEmits<{ test:[]; toggle:[]; delete:[] }>()
const dc = computed(()=>({active:'dg',disabled:'dd',error:'de'}[p.ak.status]||'dd'))
</script>
<style scoped>
.kc { display:flex; align-items:center; padding:14px 20px; gap:16px }
.ki { flex:1; display:flex; align-items:center; gap:12px }
.kp { font-weight:600; font-size:15px }
.ka { color:#CBD5E1 }
.ks { display:flex; align-items:center; gap:6px; font-size:13px }
.d { width:8px; height:8px; border-radius:50% }
.dg { background:#34D399; box-shadow:0 0 6px #34D399 }
.dd { background:#64748B }
.de { background:#FB923C; box-shadow:0 0 6px #FB923C }
.act { display:flex; gap:4px }
.ab { width:34px; height:34px; border:none; background:transparent; color:#94A3B8; cursor:pointer; border-radius:8px; font-size:16px }
.ab:hover { background:rgba(0,229,216,0.1); color:#00E5D8 }
.db:hover { background:rgba(239,68,68,0.15); color:#EF4444 }
</style>
