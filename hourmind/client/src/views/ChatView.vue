<!-- client/src/views/ChatView.vue -->
<!-- 对话页面 —— 左侧会话列表 + 右侧消息区 + 底部输入栏，支持 Markdown 渲染和流式显示 -->
<template>
  <div class="chat-page">
    <!-- ===== 左侧会话列表侧边栏 ===== -->
    <aside class="chat-sidebar">
      <!-- 新建对话按钮 —— 量子青主色，全宽 -->
      <button class="new-chat-btn" :disabled="isStreaming" @click="handleNewChat">+ 新建对话</button>

      <!-- 对话列表容器 -->
      <div class="conversation-list">
        <!-- 加载中提示 -->
        <div v-if="store.loading" class="sidebar-empty">加载中...</div>
        <!-- 空列表提示 -->
        <div v-else-if="store.conversations.length === 0" class="sidebar-empty">暂无对话</div>

        <!-- 对话列表项 —— v-for 遍历所有对话 -->
        <div
          v-for="conv in store.conversations"
          :key="conv.id"
          class="conv-item"
          :class="{ active: conv.id === store.currentConversationId }"
          @click="handleSelectConv(conv.id)"
        >
          <!-- 左侧内容：标题 + 元信息 -->
          <div class="conv-main">
            <!-- 对话标题 -->
            <div class="conv-title">{{ conv.title || '新对话' }}</div>
            <!-- 元信息行：模型名 + 消息数 + 更新时间 -->
            <div class="conv-meta">
              <span class="conv-model">{{ conv.model }}</span>
              <span class="conv-count">{{ conv.message_count }} 条消息</span>
              <span class="conv-time">{{ formatTime(conv.updated_at) }}</span>
            </div>
          </div>
          <!-- 右侧操作：删除按钮（hover 时显示） -->
          <button
            class="conv-delete-btn"
            title="删除对话"
            @click.stop="handleDeleteConv(conv.id)"
          >x</button>
        </div>
      </div>
    </aside>

    <!-- ===== 右侧主内容区 ===== -->
    <main class="chat-main">
      <!-- 顶部栏：当前对话标题 + 模型信息 -->
      <header class="chat-header" v-if="store.currentConversationId">
        <span class="chat-title-text">{{ currentConvTitle }}</span>
        <button class="chat-header-btn" @click="handleClearView">新建</button>
      </header>

      <!-- 消息列表区域 —— 滚动容器 -->
      <div class="message-list" ref="messageListRef">
        <!-- 空状态：未选择对话时显示引导 -->
        <div v-if="!store.currentConversationId && store.messages.length === 0" class="chat-empty">
          <div class="chat-empty-title">HourMind 对话</div>
          <div class="chat-empty-sub">选择左侧对话开始，或点击「新建对话」</div>
        </div>

        <!-- 错误提示条 -->
        <div v-if="store.error" class="chat-error">{{ store.error }}</div>

        <!-- 加载中 -->
        <div v-if="store.loading" class="chat-loading">加载消息中...</div>

        <!-- 消息列表渲染 -->
        <template v-for="msg in store.messages" :key="msg.id">
          <!-- 用户消息 —— 右对齐，量子青气泡 -->
          <div v-if="msg.role === 'user'" class="msg-row msg-row--user">
            <div class="msg-bubble msg-bubble--user">
              {{ msg.content }}
            </div>
          </div>

          <!-- 助手消息 —— 左对齐，玻璃卡片样式，Markdown 渲染 -->
          <div v-else-if="msg.role === 'assistant'" class="msg-row msg-row--assistant">
            <div class="msg-bubble msg-bubble--assistant glass-card">
              <!-- 使用 v-html 渲染 Markdown 内容 -->
              <div class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
              <!-- 流式输出中闪烁光标 -->
              <span v-if="isStreaming && !msg.content" class="streaming-cursor">|</span>
            </div>
          </div>

          <!-- 系统消息居中显示 -->
          <div v-else class="msg-row msg-row--system">
            <div class="msg-bubble msg-bubble--system">{{ msg.content }}</div>
          </div>
        </template>
      </div>

      <!-- ===== 底部输入区域 ===== -->
      <div class="chat-input-area">
        <!-- 输入框容器 -->
        <div class="input-wrapper">
          <!-- 多行文本输入框 —— Enter 发送，Shift+Enter 换行 -->
          <textarea
            ref="inputRef"
            v-model="inputContent"
            class="chat-textarea"
            placeholder="输入消息，Enter 发送，Shift+Enter 换行..."
            :disabled="isStreaming"
            rows="1"
            @keydown="handleKeydown"
            @input="autoResize"
          ></textarea>
        </div>
        <!-- 右侧操作按钮组 -->
        <div class="input-actions">
          <!-- 取消生成按钮 —— 流式接收时才显示 -->
          <button
            v-if="isStreaming"
            class="btn-cancel"
            @click="handleCancel"
          >取消</button>
          <!-- 发送按钮 —— 非流式时显示 -->
          <button
            v-else
            class="btn-send"
            :disabled="!inputContent.trim() || isStreaming"
            @click="handleSend"
          >▲</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
// ChatView 逻辑 —— 对话管理 + 消息发送与流式接收 + Markdown 渲染 + 自动滚动
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { marked } from 'marked'

const store = useChatStore() // 对话 Store 实例

// ===== 模板引用 =====

const messageListRef = ref<HTMLElement | null>(null) // 消息列表 DOM 引用，用于自动滚动
const inputRef = ref<HTMLTextAreaElement | null>(null) // 输入框 DOM 引用，用于自动聚焦和调整高度

// ===== 响应式状态 =====

const inputContent = ref('') // 输入框内容

// ===== 计算属性 =====

/** 当前是否正在流式接收 */
const isStreaming = computed(() => store.isStreaming)

/** 当前对话标题 —— 从对话列表中找到当前选中的对话 */
const currentConvTitle = computed(() => {
  const conv = store.conversations.find(c => c.id === store.currentConversationId)
  return conv ? conv.title || '新对话' : '对话'
})

// ===== 生命周期 =====

/** 组件挂载时加载对话列表 */
onMounted(async () => {
  await store.fetchConversations() // 加载所有对话
})

// ===== 消息列表变化时自动滚动到底部 =====

/** 监听消息列表和流式内容变化，自动滚动到底部 */
watch(
  () => [store.messages.length, store.streamingContent] as const,
  async () => {
    await nextTick() // 等待 DOM 更新完成
    scrollToBottom() // 执行滚动
  },
  { deep: false }
)

// ===== 对话操作方法 =====

/** 选中对话并加载其消息 */
async function handleSelectConv(id: string) {
  if (isStreaming.value) return // 流式接收中不允许切换对话
  await store.selectConversation(id) // 加载对话详情和消息
  await nextTick()
  scrollToBottom() // 滚动到最新消息
  inputRef.value?.focus() // 自动聚焦输入框
}

/** 删除对话 */
async function handleDeleteConv(id: string) {
  await store.deleteConversation(id) // 调用 Store 删除
}

/** 新建对话 */
async function handleNewChat() {
  if (isStreaming.value) return // 流式接收中不允许新建
  store.clearView() // 清空当前视图状态
  inputContent.value = '' // 清空输入框
  await nextTick()
  inputRef.value?.focus() // 聚焦输入框
}

/** 回到无对话视图 */
function handleClearView() {
  if (isStreaming.value) return
  store.clearView()
  inputContent.value = ''
}

// ===== 消息发送与输入处理方法 =====

/** 发送消息 */
async function handleSend() {
  const content = inputContent.value.trim() // 去除首尾空白
  if (!content || isStreaming.value) return // 空内容或流式接收中不允许发送

  inputContent.value = '' // 清空输入框
  resetTextareaHeight() // 重置输入框高度

  // 如果没有选中对话，先创建新对话
  if (!store.currentConversationId) {
    const title = content.slice(0, 20) + (content.length > 20 ? '...' : '') // 用前 20 个字符做标题
    const conv = await store.createConversation(title)
    if (!conv?.id) return // 创建失败则终止
    await store.selectConversation(conv.id) // 选中新对话
  }

  await store.sendMessage(content) // 调用 Store 发送并接收流式响应

  // 发送完成后刷新对话列表（更新标题和消息数）
  await store.fetchConversations()
  await nextTick()
  inputRef.value?.focus() // 重新聚焦输入框
}

/** 取消当前生成 */
function handleCancel() {
  store.cancelGeneration() // 关闭 WebSocket 连接
}

/** 键盘事件处理 —— Enter 发送，Shift+Enter 换行 */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault() // 阻止默认换行行为
    handleSend() // 发送消息
  }
}

// ===== 输入框高度自动调整 =====

/** 根据输入内容自动调整 textarea 高度 */
function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto' // 先重置高度
  el.style.height = Math.min(el.scrollHeight, 200) + 'px' // 设置新高度，最大 200px
}

/** 重置 textarea 高度为初始值 */
function resetTextareaHeight() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto' // 恢复默认高度
}

// ===== 自动滚动 =====

/** 将消息列表滚动到底部 */
function scrollToBottom() {
  const el = messageListRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight // 设置滚动位置到底部
}

// ===== 工具方法 =====

/** 格式化时间显示 —— 将 ISO 时间字符串转为相对时间或简短日期 */
function formatTime(iso: string): string {
  if (!iso) return '' // 空值保护
  const date = new Date(iso) // 解析 ISO 时间
  const now = new Date() // 当前时间
  const diff = now.getTime() - date.getTime() // 时间差（毫秒）
  const minutes = Math.floor(diff / 60000) // 转换为分钟
  const hours = Math.floor(diff / 3600000) // 转换为小时

  if (minutes < 1) return '刚刚' // 不到1分钟
  if (minutes < 60) return `${minutes} 分钟前` // 不到1小时
  if (hours < 24) return `${hours} 小时前` // 不到24小时
  if (hours < 48) return '昨天' // 昨天
  // 超过48小时显示日期
  return `${date.getMonth() + 1}/${date.getDate()}`
}

/** 使用 marked 渲染 Markdown 内容为 HTML */
function renderMarkdown(content: string): string {
  if (!content) return '' // 空内容返回空字符串
  try {
    return marked.parse(content) as string // 调用 marked 解析 Markdown
  } catch {
    return content // 解析失败时返回原始文本
  }
}
</script>

<style scoped>
/* ===== 页面整体布局 ===== */

/* 对话页面 —— 全屏 flex 布局，左侧侧边栏 + 右侧主内容 */
.chat-page {
  display: flex; /* 水平布局 */
  height: 100vh; /* 占满视口高度 */
  overflow: hidden; /* 禁止整体滚动，内部各自滚动 */
}

/* ===== 左侧侧边栏 ===== */

/* 会话列表侧边栏 —— 220px 固定宽度，玻璃背景 */
.chat-sidebar {
  width: 220px; /* 固定宽度 */
  min-width: 220px; /* 防止被压缩 */
  background: var(--glass-bg); /* 玻璃背景 */
  backdrop-filter: blur(20px); /* 模糊效果 */
  -webkit-backdrop-filter: blur(20px); /* Safari 兼容 */
  border-right: 1px solid var(--border-glow); /* 右侧辉光分割线 */
  display: flex; /* flex 布局 */
  flex-direction: column; /* 垂直排列 */
  overflow: hidden; /* 禁止溢出 */
}

/* 新建对话按钮 —— 量子青全宽按钮，带底部间距 */
.new-chat-btn {
  margin: 16px; /* 四周留白 */
  padding: 12px; /* 内边距 */
  background: var(--accent); /* 量子青背景 */
  color: var(--bg-primary); /* 深色文字 */
  border: none; /* 无边框 */
  border-radius: var(--radius); /* 圆角 */
  font-size: 15px; /* 字号 */
  font-weight: 600; /* 加粗 */
  cursor: pointer; /* 手型光标 */
  transition: box-shadow 0.25s ease; /* 辉光过渡动画 */
}

/* 新建按钮 hover 效果 —— 辉光增强 */
.new-chat-btn:hover {
  box-shadow: 0 0 20px rgba(0, 229, 216, 0.5); /* 辉光扩散 */
}

/* 新建按钮禁用态 */
.new-chat-btn:disabled {
  opacity: 0.5; /* 半透明 */
  cursor: not-allowed; /* 禁用光标 */
}

/* 对话列表容器 —— 可滚动区域 */
.conversation-list {
  flex: 1; /* 填充剩余空间 */
  overflow-y: auto; /* 垂直滚动 */
  padding: 0 8px 16px; /* 左右下内边距 */
}

/* 侧边栏空状态文字 */
.sidebar-empty {
  text-align: center; /* 居中对齐 */
  color: var(--text-secondary); /* 次要文字颜色 */
  padding: 32px 16px; /* 上下内边距 */
  font-size: 14px; /* 字号 */
}

/* ===== 对话列表项 ===== */

/* 单个对话项 */
.conv-item {
  display: flex; /* 水平布局 */
  align-items: center; /* 垂直居中 */
  padding: 12px; /* 内边距 */
  margin-bottom: 4px; /* 项间距 */
  border-radius: 12px; /* 圆角 */
  cursor: pointer; /* 手型光标 */
  transition: background 0.2s; /* 背景过渡动画 */
  position: relative; /* 相对定位，为删除按钮提供定位参考 */
  gap: 8px; /* 主内容与删除按钮间距 */
}

/* 对话项 hover 效果 */
.conv-item:hover {
  background: rgba(255, 255, 255, 0.05); /* 浅白色半透明背景 */
}

/* 选中状态的对话项 —— 左侧量子青竖线 + 背景高亮 */
.conv-item.active {
  background: rgba(0, 229, 216, 0.1); /* 量子青半透明背景 */
  border-left: 3px solid var(--accent); /* 左侧量子青指示线 */
}

/* 对话项左侧内容 */
.conv-main {
  flex: 1; /* 填充剩余空间 */
  overflow: hidden; /* 隐藏溢出 */
}

/* 对话标题 */
.conv-title {
  font-size: 14px; /* 字号 */
  font-weight: 500; /* 中等粗细 */
  color: var(--text-primary); /* 主文字颜色 */
  white-space: nowrap; /* 不换行 */
  overflow: hidden; /* 溢出隐藏 */
  text-overflow: ellipsis; /* 溢出显示省略号 */
  margin-bottom: 4px; /* 与元信息间距 */
}

/* 对话元信息行 */
.conv-meta {
  display: flex; /* 水平排列 */
  gap: 8px; /* 项目间距 */
  font-size: 11px; /* 小字号 */
  color: var(--text-secondary); /* 次要颜色 */
  white-space: nowrap; /* 不换行 */
  overflow: hidden; /* 隐藏溢出 */
}

/* 模型名称截断 */
.conv-model {
  max-width: 60px; /* 最大宽度 */
  overflow: hidden; /* 溢出隐藏 */
  text-overflow: ellipsis; /* 省略号 */
}

/* 删除按钮 —— 默认隐藏，hover 时显示 */
.conv-delete-btn {
  width: 22px; /* 宽度 */
  height: 22px; /* 高度 */
  border-radius: 50%; /* 圆形 */
  border: 1px solid rgba(239, 68, 68, 0.4); /* 红色半透明边框 */
  background: transparent; /* 透明背景 */
  color: var(--danger); /* 危险色文字 */
  font-size: 12px; /* 字号 */
  cursor: pointer; /* 手型光标 */
  display: flex; /* flex 居中 */
  align-items: center; /* 垂直居中 */
  justify-content: center; /* 水平居中 */
  opacity: 0; /* 默认透明 */
  transition: opacity 0.2s, background 0.2s; /* 过渡动画 */
  flex-shrink: 0; /* 不压缩 */
}

/* hover 时显示删除按钮 */
.conv-item:hover .conv-delete-btn {
  opacity: 1; /* 显示 */
}

/* 删除按钮 hover 效果 */
.conv-delete-btn:hover {
  background: rgba(239, 68, 68, 0.2); /* 红色背景 */
}

/* ===== 右侧主内容区 ===== */

/* 主聊天区域 */
.chat-main {
  flex: 1; /* 填充剩余空间 */
  display: flex; /* flex 布局 */
  flex-direction: column; /* 垂直排列 */
  min-width: 0; /* 允许收缩 */
  height: 100vh; /* 占满视口 */
}

/* 顶部标题栏 */
.chat-header {
  padding: 16px 24px; /* 内边距 */
  border-bottom: 1px solid var(--border-glow); /* 底部分割线 */
  display: flex; /* 水平布局 */
  align-items: center; /* 垂直居中 */
  justify-content: space-between; /* 左右分散 */
  flex-shrink: 0; /* 不压缩 */
}

/* 对话标题文字 */
.chat-title-text {
  font-size: 16px; /* 字号 */
  font-weight: 600; /* 加粗 */
  color: var(--text-primary); /* 主文字颜色 */
  white-space: nowrap; /* 不换行 */
  overflow: hidden; /* 溢出隐藏 */
  text-overflow: ellipsis; /* 省略号 */
}

/* 顶部操作按钮 */
.chat-header-btn {
  padding: 6px 16px; /* 内边距 */
  background: transparent; /* 透明背景 */
  color: var(--accent); /* 量子青文字 */
  border: 1px solid var(--border-glow); /* 辉光边框 */
  border-radius: 8px; /* 圆角 */
  cursor: pointer; /* 手型光标 */
  font-size: 13px; /* 字号 */
  flex-shrink: 0; /* 不压缩 */
}

/* 消息列表区域 —— 可滚动的消息容器 */
.message-list {
  flex: 1; /* 填充剩余空间 */
  overflow-y: auto; /* 垂直滚动 */
  padding: 24px; /* 内边距 */
  display: flex; /* flex 布局 */
  flex-direction: column; /* 垂直排列 */
  gap: 16px; /* 消息间距 */
}

/* 流光溢彩滚动条 —— 消息区 */
.message-list::-webkit-scrollbar {
  width: 7px; /* 略宽，突出科技感 */
}

.message-list::-webkit-scrollbar-track {
  background: rgba(30, 30, 60, 0.4); /* 深蓝紫轨道 */
  border-radius: 4px; /* 圆角 */
  margin: 4px 0; /* 上下留白 */
}

.message-list::-webkit-scrollbar-thumb {
  background: linear-gradient(
    180deg,
    #6366f1 0%, #8b5cf6 30%, #a855f7 50%, #6366f1 70%, #3b82f6 100%
  ); /* 蓝紫渐变 —— 靛蓝→紫罗兰→蓝 */
  border-radius: 4px; /* 圆角 */
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.4), inset 0 0 4px rgba(255, 255, 255, 0.1); /* 双层辉光 */
  border: 1px solid rgba(139, 92, 246, 0.15); /* 紫边 */
}

.message-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
    180deg,
    #818cf8 0%, #a78bfa 30%, #c084fc 50%, #818cf8 70%, #60a5fa 100%
  ); /* 悬停时提亮 */
  box-shadow: 0 0 18px rgba(99, 102, 241, 0.6), inset 0 0 6px rgba(255, 255, 255, 0.15); /* 辉光增强 */
}

/* 空状态显示 */
.chat-empty {
  flex: 1; /* 填充空间 */
  display: flex; /* flex 居中 */
  flex-direction: column; /* 垂直排列 */
  align-items: center; /* 水平居中 */
  justify-content: center; /* 垂直居中 */
  color: var(--text-secondary); /* 次要文字颜色 */
  gap: 8px; /* 间距 */
  text-align: center; /* 文字居中 */
}

/* 空状态主标题 */
.chat-empty-title {
  font-size: 28px; /* 大字号 */
  font-weight: 600; /* 加粗 */
  background: linear-gradient(135deg, var(--accent), var(--accent-purple)); /* 渐变色 */
  -webkit-background-clip: text; /* 背景裁剪到文字 */
  -webkit-text-fill-color: transparent; /* 文字透明以显示背景 */
}

/* 空状态副标题 */
.chat-empty-sub {
  font-size: 15px; /* 字号 */
  color: var(--text-secondary); /* 次要颜色 */
}

/* 错误提示 */
.chat-error {
  padding: 10px 16px; /* 内边距 */
  background: rgba(239, 68, 68, 0.1); /* 红色半透明背景 */
  color: var(--danger); /* 危险色文字 */
  border-radius: 8px; /* 圆角 */
  font-size: 14px; /* 字号 */
}

/* 加载中提示 */
.chat-loading {
  text-align: center; /* 居中 */
  color: var(--text-secondary); /* 次要颜色 */
  padding: 24px; /* 内边距 */
}

/* ===== 消息行与气泡 ===== */

/* 消息行 —— flex 容器，控制对齐方向 */
.msg-row {
  display: flex; /* flex 布局 */
  margin-bottom: 4px; /* 行间距 */
}

/* 用户消息行 —— 右对齐 */
.msg-row--user {
  justify-content: flex-end; /* 内容靠右 */
}

/* 助手消息行 —— 左对齐 */
.msg-row--assistant {
  justify-content: flex-start; /* 内容靠左 */
}

/* 系统消息行 —— 居中 */
.msg-row--system {
  justify-content: center; /* 居中 */
}

/* 消息气泡基础样式 */
.msg-bubble {
  max-width: 75%; /* 最大宽度 75% */
  padding: 12px 18px; /* 内边距 */
  border-radius: 16px; /* 圆角 */
  font-size: 15px; /* 字号 */
  line-height: 1.6; /* 行高 */
  word-wrap: break-word; /* 长单词换行 */
  overflow-wrap: break-word; /* 兼容换行 */
}

/* 用户消息气泡 —— 半透明背景 + 流光渐变色圈 */
.msg-bubble--user {
  position: relative; /* 为伪元素提供定位 */
  background: rgba(0, 229, 216, 0.12); /* 量子青半透明背景 */
  color: var(--text-primary); /* 白色文字 */
  border: 2px solid transparent; /* 透明底边 */
  border-bottom-right-radius: 4px; /* 右下尖角 */
  background-clip: padding-box; /* 背景裁剪，让边框区域透明 */
}

/* 流光渐变色圈 —— 用 ::before 伪元素做旋转渐变背景 */
.msg-bubble--user::before {
  content: ''; /* 伪元素必须有内容 */
  position: absolute; /* 绝对定位 */
  inset: -2px; /* 覆盖 border 区域 */
  border-radius: inherit; /* 继承圆角 */
  padding: 2px; /* 边框宽度 */
  background: conic-gradient(
    from var(--angle, 0deg),
    #00E5D8, #6366f1, #a855f7, #3b82f6, #00E5D8
  ); /* 锥形渐变：量子青→靛蓝→紫→蓝→青 */
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); /* 只显示边框区域 */
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  z-index: -1; /* 放在内容后面 */
  animation: border-rotate 3s linear infinite; /* 旋转动画 */
}

/* 色圈旋转动画 */
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes border-rotate {
  to { --angle: 360deg; }
}

/* 助手消息气泡 —— 继承 glass-card，左对齐 */
.msg-bubble--assistant {
  border-bottom-left-radius: 4px; /* 左下尖角效果 */
}

/* 系统消息气泡 —— 居中灰色小字 */
.msg-bubble--system {
  background: rgba(148, 163, 184, 0.1); /* 灰色半透明 */
  color: var(--text-secondary); /* 次要颜色 */
  font-size: 13px; /* 小字号 */
  padding: 6px 14px; /* 小内边距 */
  border-radius: 8px; /* 小圆角 */
}

/* 流式响应气泡 —— 带脉冲动画 */
.streaming-bubble {
  position: relative; /* 相对定位，为光标提供参考 */
}

/* 流式光标闪烁动画 */
.streaming-cursor {
  display: inline-block; /* 行内块 */
  color: var(--accent); /* 量子青色 */
  font-weight: bold; /* 加粗 */
  animation: blink 1s step-end infinite; /* 闪烁动画，1秒循环 */
  margin-left: 2px; /* 与文字间距 */
}

/* 光标闪烁关键帧 */
@keyframes blink {
  0%, 100% { opacity: 1; } /* 显示 */
  50% { opacity: 0; } /* 隐藏 */
}

/* ===== Markdown 渲染内容样式 ===== */

/* Markdown 内容容器 */
.markdown-body {
  color: var(--text-primary); /* 主文字颜色 */
}

/* Markdown 段落间距 */
.markdown-body :deep(p) {
  margin: 0 0 8px 0; /* 段落下边距 */
}

/* Markdown 段落最后一项不额外留白 */
.markdown-body :deep(p:last-child) {
  margin-bottom: 0; /* 移除最后一段的下边距 */
}

/* Markdown 标题样式 */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 16px 0 8px 0; /* 上下边距 */
  color: var(--text-primary); /* 主文字颜色 */
  font-weight: 600; /* 加粗 */
}

/* 各级标题字号 */
.markdown-body :deep(h1) { font-size: 1.4em; } /* 一级标题 */
.markdown-body :deep(h2) { font-size: 1.25em; } /* 二级标题 */
.markdown-body :deep(h3) { font-size: 1.1em; } /* 三级标题 */

/* Markdown 代码块样式 */
.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.4); /* 深色背景 */
  border: 1px solid var(--border-glow); /* 辉光边框 */
  border-radius: 8px; /* 圆角 */
  padding: 12px 16px; /* 内边距 */
  overflow-x: auto; /* 水平滚动 */
  margin: 8px 0; /* 上下边距 */
}

/* Markdown 行内代码样式 */
.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.3); /* 深色背景 */
  padding: 2px 6px; /* 内边距 */
  border-radius: 4px; /* 圆角 */
  font-size: 0.9em; /* 稍小字号 */
  font-family: 'Fira Code', 'Consolas', monospace; /* 等宽字体 */
}

/* Markdown 列表样式 */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px; /* 左缩进 */
  margin: 8px 0; /* 上下边距 */
}

/* Markdown 列表项样式 */
.markdown-body :deep(li) {
  margin-bottom: 4px; /* 项间距 */
}

/* Markdown 引用块样式 */
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--accent); /* 左侧量子青竖线 */
  padding-left: 12px; /* 左内边距 */
  margin: 8px 0; /* 上下边距 */
  color: var(--text-secondary); /* 次要文字颜色 */
}

/* Markdown 链接样式 */
.markdown-body :deep(a) {
  color: var(--accent); /* 量子青色 */
  text-decoration: none; /* 无下划线 */
}

/* 链接 hover 效果 */
.markdown-body :deep(a:hover) {
  text-decoration: underline; /* hover 时显示下划线 */
}

/* Markdown 表格样式 */
.markdown-body :deep(table) {
  border-collapse: collapse; /* 合并边框 */
  margin: 8px 0; /* 上下边距 */
  width: 100%; /* 全宽 */
}

/* 表格单元格样式 */
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border-glow); /* 辉光边框 */
  padding: 6px 12px; /* 内边距 */
  text-align: left; /* 左对齐 */
}

/* 表格头样式 */
.markdown-body :deep(th) {
  background: rgba(0, 229, 216, 0.1); /* 量子青半透明背景 */
}

/* Markdown 分隔线 */
.markdown-body :deep(hr) {
  border: none; /* 移除默认边框 */
  border-top: 1px solid var(--border-glow); /* 辉光上边框 */
  margin: 16px 0; /* 上下边距 */
}

/* ===== 底部输入区域 ===== */

/* 输入区域容器 —— 固定于底部 */
.chat-input-area {
  padding: 16px 24px; /* 内边距 */
  border-top: 1px solid var(--border-glow); /* 顶部分割线 */
  display: flex; /* 水平布局 */
  gap: 12px; /* 输入框与按钮间距 */
  align-items: center; /* 垂直居中 */
  flex-shrink: 0; /* 不压缩 */
  background: rgba(10, 12, 18, 0.85); /* 半透明深色背景 */
  backdrop-filter: blur(10px); /* 模糊效果 */
}

/* 输入框包装器 */
.input-wrapper {
  flex: 1; /* 填充剩余空间 */
}

/* 多行输入框 */
.chat-textarea {
  width: 100%; /* 全宽 */
  padding: 12px 16px; /* 内边距 */
  background: rgba(255, 255, 255, 0.05); /* 浅色半透明背景 */
  border: 1px solid var(--border-glow); /* 辉光边框 */
  border-radius: 12px; /* 圆角 */
  color: var(--text-primary); /* 主文字颜色 */
  font-size: 15px; /* 字号 */
  font-family: inherit; /* 继承字体 */
  line-height: 1.5; /* 行高 */
  resize: none; /* 禁止手动缩放 */
  outline: none; /* 移除默认轮廓 */
  max-height: 200px; /* 最大高度 */
  margin-bottom: 0; /* 覆盖全局 textarea 的 margin */
  transition: border-color 0.2s; /* 边框过渡 */
}

/* 输入框 placeholder 颜色 */
.chat-textarea::placeholder {
  color: var(--text-secondary); /* 次要文字颜色 */
}

/* 输入框聚焦效果 */
.chat-textarea:focus {
  border-color: var(--accent); /* 量子青边框 */
  box-shadow: 0 0 0 2px rgba(0, 229, 216, 0.15); /* 外发光 */
}

/* 输入框禁用态 */
.chat-textarea:disabled {
  opacity: 0.5; /* 半透明 */
  cursor: not-allowed; /* 禁用光标 */
}

/* 流光溢彩滚动条 —— Quantum Glass 主题 */
.chat-textarea::-webkit-scrollbar {
  width: 6px; /* 滚动条宽度 */
}

.chat-textarea::-webkit-scrollbar-track {
  background: rgba(0, 229, 216, 0.05); /* 轨道 —— 极淡量子青 */
  border-radius: 3px; /* 圆角 */
}

.chat-textarea::-webkit-scrollbar-thumb {
  background: linear-gradient(
    180deg,
    var(--accent) 0%, var(--accent-purple) 50%, var(--accent) 100%
  ); /* 滑块 —— 量子青到紫渐变 */
  border-radius: 3px; /* 圆角 */
  box-shadow: 0 0 8px rgba(0, 229, 216, 0.3); /* 辉光 */
  transition: box-shadow 0.3s; /* 辉光过渡 */
}

.chat-textarea::-webkit-scrollbar-thumb:hover {
  box-shadow: 0 0 14px rgba(0, 229, 216, 0.5); /* 悬停时辉光增强 */
}

.chat-textarea::-webkit-scrollbar-thumb:active {
  background: var(--accent); /* 拖动时纯色 */
}

/* 操作按钮组 */
.input-actions {
  display: flex; /* 水平排列 */
  gap: 8px; /* 按钮间距 */
  flex-shrink: 0; /* 不压缩 */
}

/* 发送按钮 —— 流光火箭箭头 + 旋转辉光环 */
.btn-send {
  position: relative; /* 为 ::before 旋转环定位 */
  width: 42px; /* 正方形 */
  height: 42px; /* 正方形 */
  padding: 0; /* 去掉内边距 */
  background: linear-gradient(135deg, var(--accent), var(--accent-blue), var(--accent-indigo));
  background-size: 200% 200%;
  color: #fff; /* 白色箭头 */
  border: none; /* 无边框 */
  border-radius: 13px; /* 微圆角 */
  font-size: 18px; /* 箭头字号 */
  cursor: pointer; /* 手型光标 */
  display: flex;
  align-items: center;
  justify-content: center;
  animation: gradient-shift 3s ease infinite; /* 背景渐变流动 */
  box-shadow: 0 0 16px rgba(0, 229, 216, 0.3), inset 0 0 8px rgba(255, 255, 255, 0.06); /* 外辉光 + 内微光 */
  transition: box-shadow 0.3s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性缓动 */
  z-index: 0; /* 创建层叠上下文 */
  overflow: visible; /* 允许光环溢出 */
}

/* 旋转辉光环 —— 包裹按钮的流光圆环 */
.btn-send::before {
  content: ''; /* 必须设置 */
  position: absolute;
  inset: -4px; /* 比按钮大一圈 */
  border-radius: 16px; /* 稍大的圆角 */
  padding: 2px; /* 光环宽度 */
  background: conic-gradient(
    from var(--angle, 0deg),
    var(--accent), var(--accent-blue), var(--accent-purple), var(--accent), transparent 70%
  ); /* 锥形渐变圆环 */
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude; /* 只显示边框区域 */
  z-index: -1; /* 置于按钮下方 */
  animation: border-rotate 2s linear infinite; /* 2 秒转一圈，比卡片快 */
  opacity: 0; /* 默认隐藏 */
  transition: opacity 0.3s ease; /* 淡入淡出 */
}

/* 悬停时显示旋转光环 + 超弹缩放 */
.btn-send:hover {
  box-shadow: 0 0 30px rgba(0, 229, 216, 0.55), 0 0 60px rgba(99, 102, 241, 0.25), inset 0 0 12px rgba(255, 255, 255, 0.1); /* 多层辉光 */
  transform: scale(1.12); /* 弹性放大 */
}

.btn-send:hover::before {
  opacity: 1; /* 显示旋转光环 */
}

/* 点击回弹 */
.btn-send:active {
  transform: scale(0.92); /* 按压缩小 */
  transition: transform 0.1s ease; /* 快速响应 */
}

.btn-send:disabled {
  opacity: 0.3; /* 禁用半透明 */
  cursor: not-allowed; /* 禁用光标 */
  animation: none; /* 停掉动画 */
  box-shadow: none; /* 去掉辉光 */
}

/* 取消按钮 */
/* 取消按钮 —— 红色边框按钮 */
.btn-cancel {
  padding: 10px 24px; /* 内边距 */
  background: transparent; /* 透明背景 */
  color: var(--danger); /* 危险色文字 */
  border: 1px solid rgba(239, 68, 68, 0.5); /* 红色半透明边框 */
  border-radius: 12px; /* 圆角 */
  font-size: 15px; /* 字号 */
  font-weight: 600; /* 加粗 */
  cursor: pointer; /* 手型光标 */
  transition: background 0.2s; /* 背景过渡 */
  white-space: nowrap; /* 不换行 */
}

/* 取消按钮 hover */
.btn-cancel:hover {
  background: rgba(239, 68, 68, 0.1); /* 红色半透明背景 */
}
</style>
