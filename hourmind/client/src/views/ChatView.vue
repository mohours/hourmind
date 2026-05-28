<!-- ============================================================
 ChatView.vue —— 对话主界面（新版设计）
 按照原型图重新设计：顶部栏、消息区、底部输入栏

 设计要点：
   1. 顶部栏：Logo + 标题 + 用户信息
   2. 消息区：用户消息青色气泡右对齐，AI消息深色气泡左对齐
   3. 底部输入栏：圆角设计，功能按钮 + Premium标签 + 发送按钮
============================================================ -->
<template>
  <div class="chat-container">
    <!-- ===== 顶部栏 ===== -->
    <div class="chat-header">
      <!-- 左侧：Logo -->
      <div class="header-left">
        <div class="logo">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="logo-text">HourMind</span>
        </div>
      </div>

      <!-- 中间：标题（可双击重命名） -->
      <div class="header-center">
        <span v-if="!renaming" class="title" @dblclick="startRename">{{ ti }}</span>
        <input
          v-else
          ref="ri"
          v-model="newTitle"
          class="title-input"
          @blur="saveRename"
          @keydown.enter="saveRename"
        />
      </div>

      <!-- 右侧：用户信息 -->
      <div class="header-right">
        <div class="user-info">
          <div class="user-avatar">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="user-name">Claude 4</span>
        </div>
        <!-- 右侧面板切换按钮 -->
        <button class="header-btn" :class="{ active: showPanel }" title="会话信息" @click="showPanel = !showPanel">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="header-btn" title="关闭">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="header-btn" title="通知">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ===== 子标题栏：Hrop / 模型选择 ===== -->
    <div class="sub-header">
      <span class="subtitle">Hrop</span>
      <div class="model-select-wrapper">
        <select v-model="cs.currentModel" class="model-select">
          <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
        </select>
        <svg class="select-arrow" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- ===== 主体内容（消息区 + 右侧面板）===== -->
    <div class="chat-body">
      <div class="chat-main">
        <!-- ===== 消息列表 ===== -->
        <div class="messages-container">
      <ChatMessageList v-if="cs.activeId" @regenerate="cs.regenerateLast()" />

      <!-- 欢迎页（无活跃会话时） -->
      <div v-else class="welcome-page">
        <div class="welcome-logo">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="url(#gradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="gradient" x1="3" y1="2" x2="21" y2="22">
                <stop stop-color="#00E5D8"/>
                <stop offset="1" stop-color="#6366F1"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 class="welcome-title">HourMind</h1>
        <p class="welcome-desc">选择一个会话或新建开始对话</p>
        <button class="btn-primary welcome-btn" @click="cs.createConversation()">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          开始新对话
        </button>
      </div>
    </div>

    <!-- ===== 底部输入栏 ===== -->
    <div v-if="cs.activeId" class="input-container">
      <div class="input-wrapper">
        <!-- 左侧功能按钮 -->
        <div class="input-actions">
          <button class="action-btn" title="添加图片">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="action-btn" title="上传文件">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <polyline points="17,8 12,3 7,8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="action-btn" title="快捷指令">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 7V4h3M4 17v3h3M20 7V4h-3M20 17v3h-3M9 9h6v6H9z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="action-btn" title="语音输入">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="2"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <!-- 联网搜索开关 -->
          <button
            class="action-btn"
            :class="{ 'search-active': cs.webSearchEnabled }"
            :title="cs.webSearchEnabled ? '已开启联网搜索' : '开启联网搜索'"
            @click="cs.webSearchEnabled = !cs.webSearchEnabled"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- 输入框 -->
        <input
          ref="inputRef"
          v-model="inputText"
          type="text"
          class="message-input"
          placeholder="输入消息..."
          :disabled="cs.isStreaming"
          @keydown.enter="sendMessage"
        />

        <!-- 右侧：Premium标签和发送按钮 -->
        <div class="input-right">
          <span class="premium-badge">Premium</span>
          <button
            class="send-btn"
            :disabled="!inputText.trim() || cs.isStreaming"
            @click="sendMessage"
          >
            <span>Send</span>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="action-btn expand-btn" title="展开">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 右侧辅助面板 ===== -->
    <div v-if="showPanel && cs.activeId" class="right-panel glass-card">
      <h3 class="panel-title">会话信息</h3>
      <div class="panel-field">
        <span class="panel-label">当前模型</span>
        <span class="panel-value text-cyan">{{ cs.currentModel }}</span>
      </div>
      <div class="panel-field">
        <span class="panel-label">消息数</span>
        <span class="panel-value">{{ cs.messages.length }}</span>
      </div>
      <div class="panel-field">
        <span class="panel-label">Token 消耗</span>
        <span class="panel-value">{{ totalTokens }}</span>
      </div>
      <div class="panel-field">
        <span class="panel-label">会话总数</span>
        <span class="panel-value">{{ cs.conversations.length }}</span>
      </div>
      <hr class="panel-divider" />
      <button class="panel-btn" @click="cs.regenerateLast()" :disabled="cs.isStreaming || cs.messages.length < 2">🔄 重新生成</button>
      <button class="panel-btn" @click="cs.createConversation()">➕ 新建会话</button>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
// ==================== 导入 ====================

import { computed, onMounted, ref, nextTick } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { wsClient } from '@/composables/useWs'
import ChatMessageList from '@/components/ChatMessageList.vue'

// ==================== 初始化 ====================

const cs = useChatStore()

// 右侧面板开关
const showPanel = ref(false)

// 计算 Token 消耗（从消息中累加）
const totalTokens = computed(() =>
  cs.messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0)
)

onMounted(async () => {
  await cs.fetchConversations() // 先加载会话列表
  // 从 localStorage 恢复上次打开的对话
  const lastId = localStorage.getItem('hourmind_active_conversation')
  if (lastId && cs.conversations.find(c => c.id === lastId)) {
    cs.selectConversation(lastId) // 恢复上次的会话
  }
})

// ==================== 模型列表 ====================

const models = [
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307',
  'gemini-2.0-flash',
  'grok-2',
]

// ==================== 标题 ====================

const ti = computed(() => {
  if (!cs.activeId) return '新对话'
  const c = cs.conversations.find(x => x.id === cs.activeId)
  return c?.title || '新对话'
})

// ==================== 重命名功能 ====================

const renaming = ref(false)
const newTitle = ref('')
const ri = ref<HTMLInputElement | null>(null)

function startRename() {
  if (!cs.activeId) return
  renaming.value = true
  newTitle.value = ti.value
  nextTick(() => ri.value?.focus())
}

async function saveRename() {
  renaming.value = false
  const title = newTitle.value.trim()
  if (!title || !cs.activeId || title === ti.value) return
  await wsClient.send('conversations.update', {
    conversationId: cs.activeId,
    title,
  })
  cs.fetchConversations()
}

// ==================== 输入和发送 ====================

const inputText = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function sendMessage() {
  const content = inputText.value.trim()
  if (!content || cs.isStreaming) return
  cs.sendMessage(content)
  inputText.value = ''
}
</script>

<style scoped>
/* ==================== 容器 ==================== */

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, #0D1117 0%, #0A0C12 100%);
}

/* ===== 主布局（消息 + 右侧面板）===== */
.chat-body { display: flex; flex: 1; min-height: 0; }
.chat-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }

/* ===== 右侧辅助面板 ===== */
.right-panel {
  width: 280px; flex-shrink: 0; padding: 20px;
  margin: 12px 12px 12px 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
}
.panel-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.panel-field { display: flex; justify-content: space-between; align-items: center; }
.panel-label { font-size: 13px; color: #94A3B8; }
.panel-value { font-size: 14px; font-weight: 500; color: #E2E8F0; }
.text-cyan { color: #00E5D8 !important; }
.panel-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 4px 0; }
.panel-btn {
  width: 100%; padding: 10px; background: rgba(0,229,216,0.08);
  border: 1px solid rgba(0,229,216,0.15); border-radius: 10px;
  color: #00E5D8; cursor: pointer; font-size: 13px; transition: all 0.2s;
}
.panel-btn:hover:not(:disabled) { background: rgba(0,229,216,0.15); }
.panel-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 面板开关激活态 */
.header-btn.active { background: rgba(0,229,216,0.15); color: #00E5D8; }

/* ==================== 顶部栏 ==================== */

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(0, 229, 216, 0.08);
  background: rgba(13, 17, 23, 0.8);
  backdrop-filter: blur(20px);
}

/* 左侧 Logo */
.header-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  width: 24px;
  height: 24px;
  color: #00E5D8;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #00E5D8, #6366F1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 中间标题 */
.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: #E6EDF3;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.title:hover {
  background: rgba(0, 229, 216, 0.08);
}

.title-input {
  font-size: 16px;
  font-weight: 600;
  color: #E6EDF3;
  background: rgba(0, 229, 216, 0.1);
  border: 1px solid rgba(0, 229, 216, 0.3);
  border-radius: 6px;
  padding: 4px 12px;
  text-align: center;
  outline: none;
}

/* 右侧用户信息 */
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 229, 216, 0.08);
  border-radius: 20px;
  border: 1px solid rgba(0, 229, 216, 0.15);
}

.user-avatar {
  width: 20px;
  height: 20px;
  color: #00E5D8;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: #00E5D8;
}

.header-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #94A3B8;
  cursor: pointer;
  transition: all 0.2s;
}

.header-btn:hover {
  background: rgba(0, 229, 216, 0.1);
  border-color: rgba(0, 229, 216, 0.2);
  color: #00E5D8;
}

.header-btn svg {
  width: 16px;
  height: 16px;
}

/* ==================== 子标题栏 ==================== */

.sub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(0, 229, 216, 0.05);
}

.subtitle {
  font-size: 14px;
  color: #64748B;
  font-weight: 500;
}

.model-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.model-select {
  appearance: none;
  background: rgba(0, 229, 216, 0.08);
  border: 1px solid rgba(0, 229, 216, 0.15);
  border-radius: 8px;
  padding: 6px 32px 6px 12px;
  font-size: 13px;
  color: #00E5D8;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}

.model-select:hover {
  background: rgba(0, 229, 216, 0.12);
  border-color: rgba(0, 229, 216, 0.25);
}

.select-arrow {
  position: absolute;
  right: 10px;
  width: 14px;
  height: 14px;
  color: #00E5D8;
  pointer-events: none;
}

/* ==================== 消息区域 ==================== */

.messages-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ==================== 欢迎页 ==================== */

.welcome-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.welcome-logo {
  width: 64px;
  height: 64px;
  color: #00E5D8;
}

.welcome-logo svg {
  width: 100%;
  height: 100%;
}

.welcome-title {
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(135deg, #00E5D8, #6366F1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-desc {
  font-size: 14px;
  color: #64748B;
}

.welcome-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  font-size: 14px;
}

.welcome-btn svg {
  width: 18px;
  height: 18px;
}

/* ==================== 底部输入栏 ==================== */

.input-container {
  padding: 16px 20px 20px;
  background: linear-gradient(180deg, transparent 0%, rgba(13, 17, 23, 0.8) 20%);
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 8px 16px;
  background: rgba(22, 27, 34, 0.8);
  border: 1px solid rgba(0, 229, 216, 0.1);
  border-radius: 24px;
  backdrop-filter: blur(20px);
  transition: all 0.2s;
}

.input-wrapper:focus-within {
  border-color: rgba(0, 229, 216, 0.3);
  box-shadow: 0 0 20px rgba(0, 229, 216, 0.1);
}

/* 左侧功能按钮 */
.input-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #64748B;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(0, 229, 216, 0.08);
  color: #00E5D8;
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

/* 联网搜索激活态：量子青高亮 */
.action-btn.search-active {
  background: rgba(0, 229, 216, 0.15);
  color: #00E5D8;
}

/* 输入框 */
.message-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: #E6EDF3;
  padding: 8px 0;
}

.message-input::placeholder {
  color: #64748B;
}

.message-input:disabled {
  opacity: 0.5;
}

/* 右侧 */
.input-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.premium-badge {
  padding: 4px 10px;
  background: linear-gradient(135deg, rgba(0, 229, 216, 0.15), rgba(99, 102, 241, 0.15));
  border: 1px solid rgba(0, 229, 216, 0.2);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #00E5D8;
}

.send-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #00E5D8, #00B8A9);
  border: none;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  color: #0A0C12;
  cursor: pointer;
  transition: all 0.2s;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 229, 216, 0.3);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn svg {
  width: 14px;
  height: 14px;
}

.expand-btn {
  margin-left: 4px;
}
</style>
