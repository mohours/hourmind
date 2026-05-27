<!-- ============================================================
 ChatMessageList.vue —— 消息列表（新版设计）
 可滚动区域，渲染所有消息，自动滚到底部
============================================================ -->
<template>
  <div id="chat-messages" class="messages-list">
    <!-- 消息循环 -->
    <ChatMessage
      v-for="m in cs.messages"
      :key="m.id"
      :msg="m"
      :is-streaming="cs.isStreaming"
      @regenerate="emit('regenerate')"
    />

    <!-- 流式输出指示器 -->
    <div v-if="cs.isStreaming" class="streaming-indicator">
      <div class="streaming-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span class="streaming-text">AI 正在回复...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================

import { useChatStore } from '@/stores/chatStore'
import ChatMessage from '@/components/ChatMessage.vue'

// ==================== Store ====================

const cs = useChatStore()

// ==================== Emits ====================

const emit = defineEmits<{ regenerate: [] }>()
</script>

<style scoped>
/* ==================== 消息列表容器 ==================== */

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
  scroll-behavior: smooth;
}

/* 自定义滚动条 */
.messages-list::-webkit-scrollbar {
  width: 6px;
}

.messages-list::-webkit-scrollbar-track {
  background: transparent;
}

.messages-list::-webkit-scrollbar-thumb {
  background: rgba(0, 229, 216, 0.15);
  border-radius: 3px;
}

.messages-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 229, 216, 0.25);
}

/* ==================== 流式指示器 ==================== */

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  margin-top: 8px;
}

.streaming-dots {
  display: flex;
  gap: 4px;
}

.streaming-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00E5D8;
  animation: bounce 1.4s ease-in-out infinite both;
}

.streaming-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.streaming-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

.streaming-text {
  color: #64748B;
  font-size: 13px;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
