// client/src/stores/chatStore.ts
// 对话状态管理 —— 对话列表 CRUD + 消息 WebSocket 流式传输 + 取消生成
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/appStore'

/** 对话对象接口 */
export interface Conversation {
  id: string // 对话 ID
  title: string // 对话标题
  model: string | null // 使用的 AI 模型
  tags: string[] // 标签列表
  is_pinned: boolean // 是否置顶
  is_starred: boolean // 是否收藏
  status: string // 状态：active/archived/deleted
  summary: string | null // AI 生成的摘要
  total_tokens: number // 累计 Token 消耗
  message_count: number // 消息总数
  created_at: string // 创建时间
  updated_at: string // 最后更新时间
}

/** 聊天消息接口 */
export interface Message {
  id: string // 消息 ID
  role: 'user' | 'assistant' | 'system' // 角色
  content: string // 消息内容
  model?: string // 使用的模型（仅 assistant）
  token_count?: number // Token 消耗（仅 assistant）
  created_at: string // 创建时间
}

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([]) // 对话列表
  const currentConversationId = ref<string | null>(null) // 当前选中的对话 ID
  const messages = ref<Message[]>([]) // 当前对话的消息列表
  const isStreaming = ref(false) // 是否正在接收流式响应
  const streamingContent = ref('') // 当前流式接收的增量内容
  const loading = ref(false) // 列表加载状态
  const error = ref('') // 错误信息

  /** WebSocket 实例引用 —— 用于取消连接 */
  let streamWs: WebSocket | null = null

  /** 获取认证 Token */
  function token() { return useAppStore().token }

  /** 获取对话列表 */
  async function fetchConversations(status = 'active', page = 1) {
    loading.value = true // 开始加载
    try {
      const data = await api('GET', `/conversations?status=${status}&page=${page}`, undefined, token()) // 调用后端接口
      if (data.items) {
        data.items.forEach((c: any) => { if (typeof c.tags === 'string') c.tags = JSON.parse(c.tags || '[]') })
        conversations.value = data.items // 更新列表
      }
    } catch (e: any) {
      error.value = e.message // 记录错误
    } finally {
      loading.value = false // 结束加载
    }
  }

  /** 创建新对话 */
  async function createConversation(title = '新对话', model = 'deepseek-chat') {
    const data = await api('POST', '/conversations', { title, model }, token()) // 调用创建接口
    if (data.id) {
      await fetchConversations() // 刷新列表
      currentConversationId.value = data.id // 选中新创建的对话
      messages.value = [] // 清空消息列表
    }
    return data
  }

  /** 删除对话（软删除） */
  async function deleteConversation(id: string) {
    await api('DELETE', `/conversations/${id}`, undefined, token()) // 调用删除接口
    if (currentConversationId.value === id) {
      currentConversationId.value = null // 清除选中状态
      messages.value = [] // 清空消息
    }
    await fetchConversations() // 刷新列表
  }

  /** 更新对话信息 */
  async function updateConversation(id: string, data: Partial<Conversation>) {
    const result = await api('PATCH', `/conversations/${id}`, data, token()) // 调用更新接口
    await fetchConversations() // 刷新列表
    return result
  }

  /** 选中对话并加载消息 */
  async function selectConversation(id: string) {
    currentConversationId.value = id // 设置当前对话
    messages.value = [] // 清空旧消息
    streamingContent.value = '' // 清空流式内容

    try {
      // 获取对话详情
      const data = await api('GET', `/conversations/${id}`, undefined, token())
      if (data && data.messages_json) {
        try {
          messages.value = JSON.parse(data.messages_json) // 解析 JSON 消息列表
        } catch { messages.value = [] }
      }
    } catch {
      messages.value = [] // 加载失败则清空
    }
  }

  /** 发送消息并接收流式响应 —— WebSocket 连接 /ws/chat */
  async function sendMessage(content: string) {
    if (isStreaming.value || !currentConversationId.value) return // 正在接收或未选中对话，忽略

    // 构造用户消息对象
    const userMsg: Message = {
      id: `msg_${Date.now()}`, // 临时 ID
      role: 'user', // 用户角色
      content, // 用户输入
      created_at: new Date().toISOString(), // 创建时间
    }

    // 创建一个临时的 assistant 消息占位
    const assistantMsg: Message = {
      id: `msg_${Date.now() + 1}`, // 临时 ID
      role: 'assistant', // AI 角色
      content: '', // 初始为空，流式填充
      created_at: new Date().toISOString(), // 创建时间
    }

    messages.value.push(userMsg) // 添加用户消息到列表
    messages.value.push(assistantMsg) // 添加 AI 占位消息
    isStreaming.value = true // 标记开始流式接收
    streamingContent.value = '' // 清空流式内容

    // 获取 WebSocket URL —— 通过 Vite 代理转发到后端 /ws/chat
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`

    // 建立 WebSocket 连接
    const ws = new WebSocket(wsUrl)
    streamWs = ws // 保存引用，用于取消

    ws.onopen = () => {
      // 第一步：发送认证消息
      ws.send(JSON.stringify({
        type: 'auth', // 认证请求
        token: token(), // JWT Token
      }))
    }

    /** 认证成功后发送聊天请求 */
    function sendChatRequest() {
      ws.send(JSON.stringify({
        type: 'send', // 发送聊天消息
        conversation_id: currentConversationId.value, // 对话 ID
        model: 'deepseek-chat', // 模型名称
        content: userMsg.content, // 用户消息内容
      }))
    }

    ws.onmessage = (event) => {
      let data: any
      try { data = JSON.parse(event.data) } catch { return }

      // 认证成功，发送聊天请求
      if (data.type === 'auth_ok') {
        sendChatRequest()
        return
      }

      // 处理流式内容块
      if (data.type === 'chunk') {
        streamingContent.value += data.content || ''
        // 实时更新占位消息内容
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = streamingContent.value
        }
      }
      // 处理流式结束
      else if (data.type === 'end') {
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = streamingContent.value // 确保内容完整
          lastMsg.token_count = data.token_count || 0
          lastMsg.model = data.model || ''
        }
        isStreaming.value = false // 结束流式接收
        streamingContent.value = '' // 清空流式内容
      }
      // 处理错误
      else if (data.type === 'error') {
        error.value = data.message || '未知错误'
        isStreaming.value = false
      }
    }

    ws.onerror = () => {
      error.value = 'WebSocket 连接失败'
      isStreaming.value = false
    }

    ws.onclose = () => {
      isStreaming.value = false
      streamWs = null
    }
  }

  /** 取消当前生成 */
  function cancelGeneration() {
    if (streamWs) {
      streamWs.send(JSON.stringify({ type: 'cancel' })) // 发送取消信号
      streamWs.close() // 关闭连接
      streamWs = null
    }
    // 保留已收到的部分内容
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.role === 'assistant' && streamingContent.value) {
      lastMsg.content = streamingContent.value + ' (已取消)' // 标记取消
    }
    isStreaming.value = false
    streamingContent.value = ''
  }

  /** 清空当前视图状态 */
  function clearView() {
    currentConversationId.value = null
    messages.value = []
    streamingContent.value = ''
    isStreaming.value = false
    error.value = ''
  }

  return {
    conversations, currentConversationId, messages, isStreaming,
    streamingContent, loading, error,
    fetchConversations, createConversation, deleteConversation,
    updateConversation, selectConversation, sendMessage,
    cancelGeneration, clearView,
  }
})
