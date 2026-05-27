// chatStore.ts —— 对话状态管理
import { defineStore } from 'pinia'
import { ref, nextTick } from 'vue'
import { wsClient } from '@/composables/useWs'

export interface Conversation { id: string; title: string; model: string; updatedAt: string; messageCount: number }
export interface Message { id: string; role: string; content: string; model?: string; tokenCount?: number }

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([])
  const activeId = ref<string | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const isStreaming = ref(false)
  const currentModel = ref('deepseek-v4-pro')

  function scrollToBottom() { setTimeout(() => { const el = document.getElementById('chat-messages'); if (el) el.scrollTop = el.scrollHeight }, 16) }

  async function fetchConversations() { loading.value = true; try { conversations.value = await wsClient.send('conversations.list') } finally { loading.value = false } }

  async function createConversation(): Promise<string> {
    const r = await wsClient.send('conversations.create', { title: '新对话', model: currentModel.value })
    conversations.value.unshift(r); activeId.value = r.id; messages.value = []
    localStorage.setItem('hourmind_active_conversation', r.id) // 存入 localStorage，刷新后恢复
    return r.id
  }

  async function selectConversation(id: string) {
    activeId.value = id; loading.value = true
    localStorage.setItem('hourmind_active_conversation', id) // 存入 localStorage，刷新后恢复
    try { const r = await wsClient.send('messages.list', { conversationId: id }); messages.value = r.messages || []; await nextTick(); scrollToBottom() }
    finally { loading.value = false }
  }

  async function deleteConversation(id: string) {
    await wsClient.send('conversations.delete', { conversationId: id })
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (activeId.value === id) { activeId.value = null; messages.value = []; localStorage.removeItem('hourmind_active_conversation') }
  }

  async function sendMessage(content: string) {
    if (!activeId.value) await createConversation()
    const convId = activeId.value!
    messages.value.push({ id: 'u_' + Date.now(), role: 'user', content })
    const aiId = 'a_' + Date.now()
    messages.value.push({ id: aiId, role: 'assistant', content: '' })
    await nextTick(); scrollToBottom()
    isStreaming.value = true

    try {
      const init = await wsClient.send('messages.send', { conversationId: convId, content, model: currentModel.value })
      if (init.mode === 'stream') {
        const aiMsg = messages.value.find(m => m.id === aiId)
        if (aiMsg) { aiMsg.id = init.assistant_message_id; aiMsg.model = init.model }

        const chunkH = (msg: any) => { if (msg.message_id === init.assistant_message_id) { const m = messages.value.find(x => x.id === init.assistant_message_id); if (m) m.content += msg.chunk; scrollToBottom() } }
        const endH = (msg: any) => { if (msg.message_id === init.assistant_message_id) { isStreaming.value = false; const m = messages.value.find(x => x.id === init.assistant_message_id); if (m && msg.token_count) m.tokenCount = msg.token_count; wsClient.offPush('stream_chunk', chunkH); wsClient.offPush('stream_end', endH); wsClient.offPush('stream_error', errH); fetchConversations() } }
        const errH = (msg: any) => { if (msg.message_id === init.assistant_message_id) { isStreaming.value = false; const m = messages.value.find(x => x.id === init.assistant_message_id); if (m) m.content = `[错误] ${msg.error?.message || '未知错误'}`; wsClient.offPush('stream_chunk', chunkH); wsClient.offPush('stream_end', endH); wsClient.offPush('stream_error', errH) } }

        wsClient.onPush('stream_chunk', chunkH); wsClient.onPush('stream_end', endH); wsClient.onPush('stream_error', errH)
      }
    } catch (err: any) { isStreaming.value = false; const m = messages.value.find(x => x.id === aiId); if (m) m.content = `[错误] ${err.message || '发送失败'}` }
  }

  // 重新生成最后一条 AI 回复
  async function regenerateLast() {
    if (!activeId.value || isStreaming.value) return
    const convId = activeId.value
    isStreaming.value = true

    // 移除最后一条 assistant 消息
    const lastIdx = messages.value.length - 1
    if (lastIdx >= 0 && messages.value[lastIdx].role === 'assistant') {
      messages.value.splice(lastIdx, 1)
    }
    // 插入新的空 AI 消息
    const aiId = 'a_' + Date.now()
    messages.value.push({ id: aiId, role: 'assistant', content: '' })
    await nextTick(); scrollToBottom()

    try {
      const init = await wsClient.send('messages.regenerate', { conversationId: convId })
      if (init.mode === 'stream') {
        const aiMsg = messages.value.find(m => m.id === aiId)
        if (aiMsg) { aiMsg.id = init.assistant_message_id; aiMsg.model = init.model }

        const chunkH = (msg: any) => { if (msg.message_id === init.assistant_message_id) { const m = messages.value.find(x => x.id === init.assistant_message_id); if (m) m.content += msg.chunk; scrollToBottom() } }
        const endH = (msg: any) => { if (msg.message_id === init.assistant_message_id) { isStreaming.value = false; const m = messages.value.find(x => x.id === init.assistant_message_id); if (m && msg.token_count) m.tokenCount = msg.token_count; wsClient.offPush('stream_chunk', chunkH); wsClient.offPush('stream_end', endH); wsClient.offPush('stream_error', errH) } }
        const errH = (msg: any) => { if (msg.message_id === init.assistant_message_id) { isStreaming.value = false; const m = messages.value.find(x => x.id === init.assistant_message_id); if (m) m.content = `[错误] ${msg.error?.message || '未知错误'}`; wsClient.offPush('stream_chunk', chunkH); wsClient.offPush('stream_end', endH); wsClient.offPush('stream_error', errH) } }

        wsClient.onPush('stream_chunk', chunkH); wsClient.onPush('stream_end', endH); wsClient.onPush('stream_error', errH)
      }
    } catch (err: any) { isStreaming.value = false; const m = messages.value.find(x => x.id === aiId); if (m) m.content = `[错误] ${err.message || '重新生成失败'}` }
  }

  return { conversations, activeId, messages, loading, isStreaming, currentModel, fetchConversations, createConversation, selectConversation, deleteConversation, sendMessage, regenerateLast }
})
