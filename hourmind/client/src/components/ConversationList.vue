<!--
  ConversationList.vue —— 左侧会话列表组件（ChatView 内使用）
  顶部"+ 新对话"按钮 + 会话列表（标题 + 删除按钮）
  选中会话高亮，点击加载消息历史
-->
<template>
  <div class="csb"><button class="btn-primary nb" @click="cs.createConversation()">+ 新对话</button>
    <div class="cl">
      <div v-for="c in cs.conversations" :key="c.id" :class="['ci',{ac:c.id===cs.activeId}]" @click="cs.selectConversation(c.id)"><span class="cti">{{ c.title||'新对话' }}</span><button class="cd" @click.stop="cs.deleteConversation(c.id)">✕</button></div>
      <div v-if="cs.conversations.length===0" class="ce text-muted">暂无对话</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useChatStore } from '@/stores/chatStore'
const cs = useChatStore()
</script>
<style scoped>
.csb { width:280px; min-width:280px; height:100%; background:rgba(16,18,27,0.6); border-right:1px solid rgba(0,229,216,0.1); display:flex; flex-direction:column }
.nb { margin:12px; width:calc(100% - 24px) }
.cl { flex:1; overflow-y:auto; padding:0 8px }
.ci { display:flex; align-items:center; justify-content:space-between; padding:12px; margin:2px 0; border-radius:10px; cursor:pointer; transition:all .2s }
.ci:hover { background:rgba(0,229,216,0.06) }
.ci.ac { background:rgba(0,229,216,0.1) }
.cti { font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1 }
.cd { opacity:0; background:none; border:none; color:#EF4444; cursor:pointer; font-size:14px; padding:2px 6px; border-radius:4px; transition:opacity .2s }
.ci:hover .cd { opacity:1 }
.cd:hover { background:rgba(239,68,68,0.15) }
.ce { text-align:center; padding:40px 20px; font-size:13px }
</style>
