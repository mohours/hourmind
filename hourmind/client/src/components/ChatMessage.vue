<!-- ============================================================
 ChatMessage.vue —— 单条消息组件（新版设计）
 按照原型图重新设计消息气泡样式：
   - 用户消息：青色渐变气泡，右对齐，无边框
   - AI消息：深色背景气泡，左对齐，带头像
   - 代码块：深色背景，圆角设计
============================================================ -->
<template>
  <div :class="['message-row', msg.role]">
    <!-- AI消息头像 -->
    <div v-if="msg.role === 'assistant'" class="avatar ai-avatar">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
        <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
        <path d="M8 15c1.5 2 4.5 2 6 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>

    <!-- 消息气泡 -->
    <div :class="['message-bubble', msg.role]">
      <!-- AI消息内容（Markdown渲染） -->
      <div
        v-if="msg.role === 'assistant'"
        class="message-content markdown-body"
        v-html="renderMarkdown(msg.content)"
      />

      <!-- 用户消息内容（纯文本） -->
      <div v-else class="message-content user-text">{{ msg.content }}</div>

      <!-- 操作按钮组（AI消息且非流式时显示） -->
      <div v-if="msg.role === 'assistant' && msg.content && !isStreaming" class="message-actions">
        <button class="action-btn" @click="copyText(msg.content)" title="复制">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
        <button class="action-btn" @click="$emit('regenerate')" title="重新生成">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 用户消息头像（可选） -->
    <div v-if="msg.role === 'user'" class="avatar user-avatar">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入依赖 ====================

import { marked } from 'marked'
import hljs from 'highlight.js'

// ==================== 配置 marked ====================

marked.setOptions({
  breaks: true,
  gfm: true,
})

const renderer = new marked.Renderer()

renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  const highlighted = hljs.highlight(text, { language }).value

  return `
    <div class="code-block">
      <div class="code-header">
        <span class="code-lang">${language}</span>
        <button class="code-copy"
          onclick="
            navigator.clipboard.writeText(this.dataset.code);
            this.textContent='已复制!';
            setTimeout(() => this.textContent='复制', 2000)
          "
          data-code="${escapeHtml(text)}">复制</button>
      </div>
      <pre><code class="hljs language-${language}">${highlighted}</code></pre>
    </div>`
}

marked.use({ renderer })

// ==================== Props ====================

defineProps<{
  msg: {
    id: string
    role: string
    content: string
    tokenCount?: number
  }
  isStreaming?: boolean
}>()

// ==================== Emits ====================

defineEmits<{
  regenerate: []
}>()

// ==================== 工具函数 ====================

function renderMarkdown(text: string): string {
  if (!text) return ''
  return marked.parse(text) as string
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
</script>

<style scoped>
/* ==================== 消息行布局 ==================== */

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 20px;
}

/* 用户消息右对齐 */
.message-row.user {
  flex-direction: row-reverse;
}

/* ==================== 头像 ==================== */

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar svg {
  width: 20px;
  height: 20px;
}

.ai-avatar {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #6366F1;
}

.user-avatar {
  background: linear-gradient(135deg, rgba(0, 229, 216, 0.2), rgba(0, 184, 169, 0.2));
  border: 1px solid rgba(0, 229, 216, 0.3);
  color: #00E5D8;
}

/* ==================== 消息气泡 ==================== */

.message-bubble {
  max-width: 70%;
  border-radius: 16px;
  overflow: hidden;
}

/* AI消息气泡：深色背景 */
.message-bubble.assistant {
  background: rgba(22, 27, 34, 0.9);
  border: 1px solid rgba(0, 229, 216, 0.1);
  border-radius: 4px 16px 16px 16px;
}

/* 用户消息气泡：青色渐变 */
.message-bubble.user {
  background: linear-gradient(135deg, #00E5D8, #00B8A9);
  border-radius: 16px 4px 16px 16px;
}

/* ==================== 消息内容 ==================== */

.message-content {
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
}

/* AI消息文字颜色 */
.message-bubble.assistant .message-content {
  color: #E6EDF3;
}

/* 用户消息文字颜色 */
.message-bubble.user .message-content {
  color: #0A0C12;
  font-weight: 500;
}

.user-text {
  white-space: pre-wrap;
  word-break: break-word;
}

/* ==================== 操作按钮 ==================== */

.message-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid rgba(0, 229, 216, 0.05);
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #64748B;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(0, 229, 216, 0.08);
  color: #00E5D8;
}

.action-btn svg {
  width: 14px;
  height: 14px;
}

/* ==================== Markdown 样式 ==================== */

.markdown-body :deep(p) {
  margin: 0 0 10px;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
  margin: 0 0 10px;
}

.markdown-body :deep(li) {
  margin-bottom: 4px;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 12px 0 8px;
  font-weight: 600;
  color: #F1F5F9;
}

.markdown-body :deep(h1) { font-size: 18px; }
.markdown-body :deep(h2) { font-size: 16px; }
.markdown-body :deep(h3) { font-size: 14px; }

.markdown-body :deep(blockquote) {
  border-left: 3px solid #00E5D8;
  padding-left: 12px;
  color: #94A3B8;
  margin: 8px 0;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: rgba(0, 229, 216, 0.08);
  font-weight: 600;
}

.markdown-body :deep(a) {
  color: #00E5D8;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(strong) {
  font-weight: 600;
  color: #F1F5F9;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  margin: 12px 0;
}

/* ==================== 代码块 ==================== */

.markdown-body :deep(.code-block) {
  margin: 10px 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0, 229, 216, 0.1);
  background: rgba(10, 12, 18, 0.6);
}

.markdown-body :deep(.code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(0, 229, 216, 0.05);
  border-bottom: 1px solid rgba(0, 229, 216, 0.05);
}

.markdown-body :deep(.code-lang) {
  color: #64748B;
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.markdown-body :deep(.code-copy) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94A3B8;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.markdown-body :deep(.code-copy:hover) {
  background: rgba(0, 229, 216, 0.1);
  border-color: rgba(0, 229, 216, 0.2);
  color: #00E5D8;
}

.markdown-body :deep(pre) {
  margin: 0;
  padding: 12px 16px;
  overflow-x: auto;
  background: transparent;
}

.markdown-body :deep(code) {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.markdown-body :deep(p code),
.markdown-body :deep(li code) {
  background: rgba(0, 229, 216, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #00E5D8;
}
</style>
