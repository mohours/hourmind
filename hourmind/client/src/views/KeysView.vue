<!--
  KeysView.vue —— API Key 管理页面
  顶部统计卡片（总数/活跃/月消耗）+ 搜索筛选栏 + Key 卡片列表 + 添加弹窗
  数据来自 keyStore，操作通过 wsClient.send('keys.*') 与后端通信
-->
<template>
  <div class="kp">
    <div class="kh"><h2>API Key 管理</h2><button class="btn-primary" @click="open">+ 添加新 Key</button></div>
    <div class="sr">
      <div class="glass-card sc" v-for="(v,l,i) in [{l:'总数',k:'total'},{l:'活跃',k:'active'},{l:'月消耗',k:'monthlyCost'}]" :key="i">
        <span class="sl">{{ v.l }}</span>
        <span :class="['sv', v.k==='active'?'text-success':'']">{{ v.k==='monthlyCost' ? '$'+(ks.stats[v.k]/100).toFixed(2) : ks.stats[v.k] }}</span>
      </div>
    </div>
    <div class="fr">
      <input v-model="ks.search" placeholder="搜索..." class="si" @input="ks.fetchKeys()" />
      <select v-model="ks.statusFilter" @change="ks.fetchKeys()">
        <option value="all">全部</option><option value="active">活跃</option><option value="disabled">禁用</option><option value="error">异常</option>
      </select>
    </div>
    <div v-if="ks.loading" class="hint">加载中...</div>
    <div v-else-if="ks.filteredKeys.length===0" class="hint"><p>还没有添加 Key</p><p class="text-muted">点击上方按钮开始</p></div>
    <div v-else class="kg"><KeyCard v-for="k in ks.filteredKeys" :key="k.id" :ak="k" @test="ht(k.id)" @toggle="htg(k.id,k.status!=='active')" @delete="hd(k.id)" /></div>
    <AddKeyDialog v-if="ks.showAddDialog" @close="ks.showAddDialog=false" @created="oc" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'; import { useKeyStore } from '@/stores/keyStore'; import KeyCard from '@/components/KeyCard.vue'; import AddKeyDialog from '@/components/AddKeyDialog.vue'
const ks = useKeyStore()
onMounted(()=>{ks.fetchKeys();ks.fetchStats()})
function open(){ks.fetchProviders();ks.showAddDialog=true}
async function ht(id:string){const r=await ks.testKey(id);alert(r.success?`测试通过 ${r.latencyMs}ms`:`失败:${r.errorMessage}`)}
async function htg(id:string,on:boolean){await ks.toggleKey(id,on)}
async function hd(id:string){if(confirm('确定删除？'))await ks.deleteKey(id)}
function oc(){ks.showAddDialog=false;ks.fetchKeys();ks.fetchStats()}
</script>

<style scoped>
.kp { padding:32px 40px; height:100%; overflow-y:auto }
.kh { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px }
.kh h2 { font-size:24px; font-weight:700 }
.sr { display:flex; gap:16px; margin-bottom:20px }
.sc { flex:1; padding:16px 20px; display:flex; flex-direction:column; gap:4px }
.sl { font-size:12px; color:#94A3B8 }
.sv { font-size:24px; font-weight:700 }
.fr { display:flex; gap:12px; margin-bottom:20px }
.si { flex:1 }
.kg { display:flex; flex-direction:column; gap:12px }
.hint { text-align:center; padding:60px 20px }
</style>
