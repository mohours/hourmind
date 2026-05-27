<!--
 HistoryView.vue —— 历史记录页面
 对话资产管理中心：搜索、筛选、批量操作、AI 摘要
 Quantum Glass 风格
-->
<template>
  <div class="history-page">
    <!-- ===== 顶部工具栏 ===== -->
    <div class="toolbar">
      <h2 class="title">历史记录</h2>
      <div class="toolbar-actions">
        <!-- 搜索框 -->
        <input
          v-model="hs.search"
          class="search-input"
          placeholder="搜索对话标题..."
          @input="hs.setFilter('search', ($event.target as HTMLInputElement).value)"
        />
        <!-- 状态筛选 -->
        <select v-model="hs.statusFilter" class="filter-select" @change="hs.setFilter('status', ($event.target as HTMLSelectElement).value)">
          <option value="all">全部</option>
          <option value="active">活跃</option>
          <option value="archived">已归档</option>
          <option value="deleted">已删除</option>
        </select>
        <!-- 批量操作按钮 -->
        <button v-if="hs.showBatchBar" class="btn-batch" @click="hs.batchArchive()">📦 归档</button>
        <button v-if="hs.showBatchBar" class="btn-batch btn-danger" @click="hs.batchDelete()">🗑 删除</button>
        <button v-if="hs.showBatchBar" class="btn-batch" @click="hs.batchExport('md')">📥 导出 MD</button>
        <span v-if="hs.showBatchBar" class="batch-count">已选 {{ hs.selectedIds.size }} 项</span>
      </div>
    </div>

    <!-- ===== 加载状态 ===== -->
    <div v-if="hs.loading && hs.conversations.length === 0" class="hint text-muted">加载中...</div>

    <!-- ===== 空状态 ===== -->
    <div v-else-if="!hs.loading && hs.conversations.length === 0" class="hint">
      <p class="text-muted" style="font-size:16px">暂无历史对话</p>
      <p class="text-muted" style="font-size:13px;margin-top:4px">开始对话后，记录会出现在这里</p>
    </div>

    <!-- ===== 对话列表 ===== -->
    <div v-else class="list">
      <div
        v-for="conv in hs.conversations"
        :key="conv.id"
        class="glass-card list-item"
        :class="{ selected: hs.selectedIds.has(conv.id) }"
      >
        <!-- 复选框 -->
        <input
          type="checkbox"
          class="item-checkbox"
          :checked="hs.selectedIds.has(conv.id)"
          @change="hs.toggleSelect(conv.id)"
        />
        <!-- 对话信息 -->
        <div class="item-info" @click="openConversation(conv.id)">
          <div class="item-header">
            <span class="item-title">{{ conv.title || '新对话' }}</span>
            <!-- 状态标签 -->
            <span v-if="conv.status === 'deleted'" class="tag tag-deleted">已删除</span>
            <span v-else-if="conv.status === 'archived'" class="tag tag-archived">已归档</span>
          </div>
          <!-- 预览文本 -->
          <span class="item-preview text-muted">{{ conv.preview || '暂无消息' }}</span>
          <!-- 摘要（AI 生成） -->
          <span v-if="conv.summary" class="item-summary">📝 {{ conv.summary }}</span>
          <div class="item-meta">
            <span class="item-model">{{ conv.model }}</span>
            <span class="text-muted">{{ conv.messageCount }} 条消息</span>
            <span class="text-muted">{{ fmtTime(conv.updatedAt) }}</span>
          </div>
        </div>
        <!-- 操作按钮 -->
        <div class="item-actions">
          <button class="action-btn" title="打开对话" @click="openConversation(conv.id)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
          <button
            v-if="conv.status === 'deleted'"
            class="action-btn"
            title="恢复"
            @click="hs.recoverConversation(conv.id)"
          >🔄</button>
          <button
            class="action-btn"
            title="AI 摘要"
            :disabled="hs.summarizingId === conv.id"
            @click="hs.summarize(conv.id)"
          >
            <span v-if="hs.summarizingId === conv.id">⏳</span>
            <span v-else>✨</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue' // 页面生命周期
import { useRouter } from 'vue-router' // 路由跳转
import { useHistoryStore } from '@/stores/historyStore' // 历史记录状态
import { useChatStore } from '@/stores/chatStore' // 对话状态（打开对话用）

const hs = useHistoryStore() // 历史记录 store
const chatStore = useChatStore() // 对话 store
const router = useRouter() // 路由实例

// 页面加载时获取历史列表
onMounted(() => hs.init())

// 格式化时间（相对时间）
function fmtTime(dateStr: string): string {
  const now = Date.now() // 当前时间戳
  const then = new Date(dateStr).getTime() // 更新时间戳
  const diff = Math.floor((now - then) / 1000) // 相差秒数
  if (diff < 60) return '刚刚' // 不到 1 分钟
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前` // 不到 1 小时
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前` // 不到 1 天
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前` // 不到 1 周
  const d = new Date(dateStr) // 超过一周显示日期
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// 打开对话 → 加载消息 → 跳转到聊天页
async function openConversation(id: string) {
  await chatStore.selectConversation(id) // 加载消息历史
  router.push('/chat') // 跳转到对话页
}
</script>

<style scoped>
/* 页面容器 */
.history-page {
  padding: 36px 40px; /* 内部间距 */
  height: 100%; /* 填满父容器 */
  overflow-y: auto; /* 内容溢出时滚动 */
}

/* 顶部工具栏 */
.toolbar {
  display: flex; /* Flex 布局 */
  justify-content: space-between; /* 左右两端 */
  align-items: center; /* 垂直居中 */
  margin-bottom: 24px; /* 底部间距 */
  flex-wrap: wrap; /* 窄屏换行 */
  gap: 12px; /* 换行间距 */
}

.title {
  font-size: 24px; /* 大标题 */
  font-weight: 700; /* 粗体 */
}

/* 工具栏右侧操作区 */
.toolbar-actions {
  display: flex; /* Flex */
  align-items: center; /* 垂直居中 */
  gap: 10px; /* 间距 */
  flex-wrap: wrap; /* 窄屏换行 */
}

/* 搜索框 */
.search-input {
  width: 220px; /* 固定宽度 */
  padding: 8px 14px; /* 内部间距 */
}

/* 筛选下拉 */
.filter-select {
  padding: 8px 14px; /* 内部间距 */
}

/* 批量操作按钮 */
.btn-batch {
  padding: 8px 14px; /* 内部间距 */
  background: rgba(0, 229, 216, 0.1); /* 量子青半透明 */
  border: 1px solid rgba(0, 229, 216, 0.2); /* 量子青边框 */
  border-radius: 10px; /* 圆角 */
  color: #00E5D8; /* 量子青 */
  cursor: pointer; /* 手型光标 */
  font-size: 13px; /* 小号字体 */
  transition: all 0.2s; /* 过渡 */
}
.btn-batch:hover {
  background: rgba(0, 229, 216, 0.2); /* 悬停加深 */
}
.btn-danger {
  color: #EF4444; /* 红色文字 */
  border-color: rgba(239, 68, 68, 0.2); /* 红色边框 */
  background: rgba(239, 68, 68, 0.1); /* 红色半透明 */
}
.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2); /* 悬停加深 */
}

.batch-count {
  font-size: 13px; /* 小号字体 */
  color: #00E5D8; /* 量子青 */
}

/* 列表容器 */
.list {
  display: flex; /* Flex 列布局 */
  flex-direction: column; /* 纵向排列 */
  gap: 10px; /* 行间距 */
}

/* 列表项 */
.list-item {
  display: flex; /* Flex 行布局 */
  align-items: flex-start; /* 顶部对齐 */
  gap: 14px; /* 间距 */
  padding: 16px 20px; /* 内部间距 */
  transition: all 0.2s; /* 过渡动画 */
}
.list-item.selected {
  border-color: rgba(0, 229, 216, 0.5); /* 选中时辉光增强 */
  background: rgba(0, 229, 216, 0.06); /* 选中背景 */
}

/* 复选框 */
.item-checkbox {
  margin-top: 4px; /* 微调对齐 */
  width: 16px; /* 固定宽度 */
  height: 16px; /* 固定高度 */
  cursor: pointer; /* 手型光标 */
  accent-color: #00E5D8; /* 量子青勾选色 */
}

/* 对话信息区 */
.item-info {
  flex: 1; /* 占满剩余空间 */
  cursor: pointer; /* 手型光标 */
  display: flex; /* Flex 列布局 */
  flex-direction: column; /* 纵向排列 */
  gap: 4px; /* 间距 */
}

/* 标题行 */
.item-header {
  display: flex; /* Flex */
  align-items: center; /* 垂直居中 */
  gap: 8px; /* 间距 */
}

.item-title {
  font-size: 15px; /* 中号字体 */
  font-weight: 600; /* 半粗体 */
  color: #F1F5F9; /* 浅色 */
}

/* 状态标签 */
.tag {
  font-size: 11px; /* 极小字体 */
  padding: 2px 8px; /* 内部间距 */
  border-radius: 8px; /* 圆角 */
}
.tag-deleted {
  background: rgba(239, 68, 68, 0.15); /* 红色半透明背景 */
  color: #EF4444; /* 红色文字 */
}
.tag-archived {
  background: rgba(251, 191, 36, 0.15); /* 黄色半透明背景 */
  color: #FBBF24; /* 黄色文字 */
}

/* 预览文本 */
.item-preview {
  font-size: 13px; /* 小号字体 */
  overflow: hidden; /* 溢出隐藏 */
  text-overflow: ellipsis; /* 省略号 */
  white-space: nowrap; /* 不换行 */
}

/* AI 摘要 */
.item-summary {
  font-size: 12px; /* 极小字体 */
  color: #00E5D8; /* 量子青 */
  background: rgba(0, 229, 216, 0.06); /* 量子青半透明背景 */
  padding: 4px 10px; /* 内部间距 */
  border-radius: 8px; /* 圆角 */
  border-left: 2px solid rgba(0, 229, 216, 0.3); /* 左侧量子青竖条 */
}

/* 元数据行 */
.item-meta {
  display: flex; /* Flex */
  gap: 14px; /* 间距 */
  font-size: 12px; /* 极小字体 */
  margin-top: 2px; /* 顶部微调 */
}

.item-model {
  color: #00E5D8; /* 量子青 */
}

/* 操作按钮 */
.item-actions {
  display: flex; /* Flex */
  gap: 8px; /* 间距 */
  flex-shrink: 0; /* 不缩小 */
}

.action-btn {
  width: 36px; /* 固定宽 */
  height: 36px; /* 固定高 */
  display: flex; /* Flex 居中 */
  align-items: center; /* 垂直居中 */
  justify-content: center; /* 水平居中 */
  background: rgba(255, 255, 255, 0.04); /* 极淡背景 */
  border: 1px solid rgba(255, 255, 255, 0.08); /* 极淡边框 */
  border-radius: 10px; /* 圆角 */
  color: #94A3B8; /* 石板灰 */
  cursor: pointer; /* 手型光标 */
  font-size: 14px; /* 小号字体 */
  transition: all 0.2s; /* 过渡 */
}
.action-btn:hover:not(:disabled) {
  background: rgba(0, 229, 216, 0.1); /* 悬停量子青 */
  border-color: rgba(0, 229, 216, 0.2); /* 悬停边框 */
  color: #00E5D8; /* 悬停量子青 */
}
.action-btn:disabled {
  opacity: 0.4; /* 禁用半透明 */
  cursor: not-allowed; /* 禁用光标 */
}

/* 提示 */
.hint {
  text-align: center; /* 居中 */
  padding: 60px 20px; /* 上下间距 */
}
</style>
