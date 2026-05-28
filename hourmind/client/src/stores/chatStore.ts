// ============================================================
// chatStore.ts —— 智能对话状态管理（Pinia Store）
//
// 管理对话页面的全部状态，是前端最复杂的 Store。
// 负责会话列表、消息收发、流式输出、重新生成等功能。
//
// 状态（state）：
//   conversations  — 会话列表（左侧栏）
//   activeId       — 当前活跃的会话 ID
//   messages       — 当前会话的消息列表
//   loading        — 加载状态
//   isStreaming    — 是否正在流式输出（显示打字动画）
//   currentModel   — 当前选择的 AI 模型
//
// 核心流程 — 发送消息：
//   1. 如果没有活跃会话 → 先创建新会话
//   2. 添加用户消息到 messages（乐观更新：先显示再请求）
//   3. 添加空的 AI 消息占位
//   4. 发 messages.send 请求 → 后端返回 { mode: 'stream' }
//   5. 注册 stream_chunk 监听 → 每收到 token 追加到 AI 消息内容
//   6. 收到 stream_end → 更新 tokenCount → 取消监听 → 刷新会话列表
//
// 什么是乐观更新？
//   不等后端确认，先在 UI 显示结果。
//   用户消息发送后立刻显示在界面上，而不是等后端返回再显示。
//   好处是体验更流畅，用户不会觉得卡。
// ============================================================

// defineStore：定义 Pinia Store
import { defineStore } from 'pinia'
// ref：响应式变量
// nextTick：等 DOM 更新后执行（用于滚动到底部）
import { ref, nextTick } from 'vue'
// wsClient：WebSocket 客户端
import { wsClient } from '@/composables/useWs'

// Conversation 类型：会话列表中的一项
export interface Conversation {
  id: string        // 会话 ID
  title: string     // 会话标题
  model: string     // 使用的模型
  updatedAt: string // 最后更新时间
  messageCount: number // 消息数
}

// Message 类型：一条消息
export interface Message {
  id: string         // 消息 ID
  role: string       // 'user' 或 'assistant'
  content: string    // 消息内容
  model?: string     // 使用的模型（仅 AI 消息）
  tokenCount?: number // Token 消耗（仅 AI 消息）
}

export const useChatStore = defineStore('chat', () => {
  // ——— 状态 ———

  const conversations = ref<Conversation[]>([])  // 会话列表
  const activeId = ref<string | null>(null)       // 当前活跃会话
  const messages = ref<Message[]>([])              // 当前会话的消息
  const loading = ref(false)                       // 加载中
  const isStreaming = ref(false)                   // 是否在流式输出
  const currentModel = ref('deepseek-v4-pro')      // 当前模型
  const webSearchEnabled = ref(false)               // 联网搜索开关

  // ——— 工具函数 ———

  // scrollToBottom()：把消息区域滚到底部（最新消息可见）
  function scrollToBottom() {
    // setTimeout 16ms ≈ 1 帧（等 Vue 渲染完 DOM 再滚动）
    setTimeout(() => {
      const el = document.getElementById('chat-messages') // 消息容器的 DOM 元素
      if (el) el.scrollTop = el.scrollHeight              // 滚到底部
    }, 16)
  }

  // ——— 操作 ———

  // fetchConversations()：从后端获取会话列表
  async function fetchConversations() {
    loading.value = true
    try {
      conversations.value = await wsClient.send('conversations.list')
    } finally {
      loading.value = false
    }
  }

  // createConversation()：创建新会话
  // 返回新会话的 ID（sendMessage 需要）
  async function createConversation(): Promise<string> {
    const r = await wsClient.send('conversations.create', {
      title: '新对话',
      model: currentModel.value,
    })

    // 把新会话插到列表最前面
    conversations.value.unshift(r)
    // 设为活跃会话
    activeId.value = r.id
    // 清空消息列表（新会话还没有消息）
    messages.value = []

    // 存到 localStorage，页面刷新后能恢复
    localStorage.setItem('hourmind_active_conversation', r.id)

    return r.id
  }

  // selectConversation(id)：选中一个会话 → 加载它的消息
  async function selectConversation(id: string) {
    activeId.value = id
    loading.value = true

    // 存到 localStorage，刷新后恢复上次选中的会话
    localStorage.setItem('hourmind_active_conversation', id)

    try {
      // 调 messages.list 获取消息历史
      const r = await wsClient.send('messages.list', { conversationId: id })
      messages.value = r.messages || []

      // 等 Vue 渲染完 DOM → 滚到底部
      await nextTick()
      scrollToBottom()
    } finally {
      loading.value = false
    }
  }

  // deleteConversation(id)：删除会话（软删除，status→archived）
  async function deleteConversation(id: string) {
    await wsClient.send('conversations.delete', { conversationId: id })

    // 从列表中移除
    conversations.value = conversations.value.filter(c => c.id !== id)

    // 如果删除的是当前活跃会话 → 回到空状态
    if (activeId.value === id) {
      activeId.value = null
      messages.value = []
      localStorage.removeItem('hourmind_active_conversation')
    }
  }

  // ——— 核心：sendMessage(content) ———
  // 发送消息并以流式方式展示 AI 回复
  async function sendMessage(content: string) {
    // 1. 如果没有活跃会话 → 先创建一个
    if (!activeId.value) {
      await createConversation()
    }

    const convId = activeId.value!

    // 2. 乐观更新：先添加用户消息到界面（不等后端返回）
    messages.value.push({
      id: 'u_' + Date.now(),   // 临时 ID（加 u_ 前缀标识用户消息）
      role: 'user',
      content,
    })

    // 3. 添加空 AI 消息占位（流式内容会逐步填充）
    const aiId = 'a_' + Date.now()  // 临时 ID（加 a_ 前缀标识 AI 消息）
    messages.value.push({
      id: aiId,
      role: 'assistant',
      content: '',  // 空内容，流式推送时会逐字填充
    })

    // 等 Vue 渲染 → 滚到底部
    await nextTick()
    scrollToBottom()

    // 标记流式输出开始
    isStreaming.value = true

    try {
      // 4. 发送消息
      //    如果 webSearchEnabled=true，带上 webSearch 标记发送给后端
      const init = await wsClient.send('messages.send', {
        conversationId: convId,
        content,
        model: currentModel.value,
        webSearch: webSearchEnabled.value || undefined,
      })

      if (init.mode === 'stream') {
        // 5. 用后端返回的真实 message_id 替换临时 ID
        const aiMsg = messages.value.find(m => m.id === aiId)
        if (aiMsg) {
          aiMsg.id = init.assistant_message_id
          aiMsg.model = init.model
        }

        // 6. 注册流式推送监听

        // ——— stream_chunk：每收到一个 token ———
        const chunkH = (msg: any) => {
          // 确认是当前消息的 token（可能同时有多个流在进行）
          if (msg.message_id === init.assistant_message_id) {
            const m = messages.value.find(x => x.id === init.assistant_message_id)
            // 把新 token 追加到 AI 消息内容末尾
            if (m) m.content += msg.chunk
            scrollToBottom()
          }
        }

        // ——— stream_end：流正常结束 ———
        const endH = (msg: any) => {
          if (msg.message_id === init.assistant_message_id) {
            isStreaming.value = false

            // 更新 tokenCount
            const m = messages.value.find(x => x.id === init.assistant_message_id)
            if (m && msg.token_count) m.tokenCount = msg.token_count

            // 取消所有监听（避免内存泄漏）
            wsClient.offPush('stream_chunk', chunkH)
            wsClient.offPush('stream_end', endH)
            wsClient.offPush('stream_error', errH)

            // 刷新会话列表（更新时间、消息数等）
            fetchConversations()
          }
        }

        // ——— stream_error：流出错 ———
        const errH = (msg: any) => {
          if (msg.message_id === init.assistant_message_id) {
            isStreaming.value = false

            // 显示错误信息
            const m = messages.value.find(x => x.id === init.assistant_message_id)
            if (m) m.content = `[错误] ${msg.error?.message || '未知错误'}`

            // 取消监听
            wsClient.offPush('stream_chunk', chunkH)
            wsClient.offPush('stream_end', endH)
            wsClient.offPush('stream_error', errH)
          }
        }

        // 注册三个监听
        wsClient.onPush('stream_chunk', chunkH)
        wsClient.onPush('stream_end', endH)
        wsClient.onPush('stream_error', errH)
      }
    } catch (err: any) {
      // 请求本身失败了（非流式错误）
      isStreaming.value = false
      const m = messages.value.find(x => x.id === aiId)
      if (m) m.content = `[错误] ${err.message || '发送失败'}`
    }
  }

  // ——— regenerateLast()：重新生成最后一条 AI 回复 ———
  // 和 sendMessage 类似，但不需要用户消息，直接重新调 AI
  async function regenerateLast() {
    if (!activeId.value || isStreaming.value) return // 防止重复点击

    const convId = activeId.value
    isStreaming.value = true

    // 移除最后一条 AI 消息
    const lastIdx = messages.value.length - 1
    if (lastIdx >= 0 && messages.value[lastIdx].role === 'assistant') {
      messages.value.splice(lastIdx, 1) // splice 从数组中删除
    }

    // 插入新的空 AI 消息占位
    const aiId = 'a_' + Date.now()
    messages.value.push({ id: aiId, role: 'assistant', content: '' })
    await nextTick()
    scrollToBottom()

    try {
      // 调 messages.regenerate
      const init = await wsClient.send('messages.regenerate', { conversationId: convId })

      if (init.mode === 'stream') {
        // 替换临时 ID
        const aiMsg = messages.value.find(m => m.id === aiId)
        if (aiMsg) {
          aiMsg.id = init.assistant_message_id
          aiMsg.model = init.model
        }

        // 三个监听（和 sendMessage 中的逻辑一样）
        const chunkH = (msg: any) => {
          if (msg.message_id === init.assistant_message_id) {
            const m = messages.value.find(x => x.id === init.assistant_message_id)
            if (m) m.content += msg.chunk
            scrollToBottom()
          }
        }
        const endH = (msg: any) => {
          if (msg.message_id === init.assistant_message_id) {
            isStreaming.value = false
            const m = messages.value.find(x => x.id === init.assistant_message_id)
            if (m && msg.token_count) m.tokenCount = msg.token_count
            wsClient.offPush('stream_chunk', chunkH)
            wsClient.offPush('stream_end', endH)
            wsClient.offPush('stream_error', errH)
          }
        }
        const errH = (msg: any) => {
          if (msg.message_id === init.assistant_message_id) {
            isStreaming.value = false
            const m = messages.value.find(x => x.id === init.assistant_message_id)
            if (m) m.content = `[错误] ${msg.error?.message || '未知错误'}`
            wsClient.offPush('stream_chunk', chunkH)
            wsClient.offPush('stream_end', endH)
            wsClient.offPush('stream_error', errH)
          }
        }

        wsClient.onPush('stream_chunk', chunkH)
        wsClient.onPush('stream_end', endH)
        wsClient.onPush('stream_error', errH)
      }
    } catch (err: any) {
      isStreaming.value = false
      const m = messages.value.find(x => x.id === aiId)
      if (m) m.content = `[错误] ${err.message || '重新生成失败'}`
    }
  }

  return {
    conversations, activeId, messages, loading, isStreaming, currentModel,
    webSearchEnabled,
    fetchConversations, createConversation, selectConversation, deleteConversation,
    sendMessage, regenerateLast,
  }
})
