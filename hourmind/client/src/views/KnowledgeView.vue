<!-- client/src/views/KnowledgeView.vue -->
<!-- 知识库页面 —— 搜索栏、类型筛选、双列卡片网格、详情弹窗 -->
<template>
  <div class="knowledge-page" style="padding: 40px; max-width: 1100px; margin: 0 auto;">
    <!-- 页面头部 -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 28px;">知识库</h2>
    </div>

    <!-- 搜索 + 类型筛选行 -->
    <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 24px; flex-wrap: wrap;">
      <!-- 搜索框 -->
      <input v-model="searchQuery" class="auth-input" placeholder="搜索知识条目..."
             style="width: 300px; margin-bottom: 0;" @keyup.enter="handleSearch" />
      <button class="btn-primary" style="padding: 10px 20px;" @click="handleSearch">搜索</button>

      <!-- 类型筛选标签 -->
      <div style="display: flex; gap: 8px; margin-left: 8px;">
        <button v-for="tab in typeTabs" :key="tab.value"
                @click="activeType = tab.value; loadEntries()"
                :style="{
                  padding: '8px 16px', fontSize: '13px', borderRadius: '20px', border: '1px solid',
                  borderColor: activeType === tab.value ? 'var(--accent)' : 'var(--border-glow)',
                  background: activeType === tab.value ? 'rgba(0,229,216,0.1)' : 'transparent',
                  color: activeType === tab.value ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }">
          {{ tab.label }}
        </button>
      </div>

      <!-- 新建按钮 -->
      <button class="btn-primary" style="padding: 10px 20px; margin-left: auto;" @click="openCreateDialog">
        新建条目
      </button>
    </div>

    <!-- 加载状态 -->
    <p v-if="knowledgeStore.loading" style="color: var(--text-secondary); text-align: center; padding: 40px;">加载中...</p>

    <!-- 空状态 -->
    <div v-if="!knowledgeStore.loading && knowledgeStore.entries.length === 0" class="glass-card" style="padding: 48px; text-align: center; color: var(--text-secondary);">
      暂无知识条目，点击"新建条目"开始
    </div>

    <!-- 知识卡片双列网格 -->
    <div v-if="!knowledgeStore.loading" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
      <div v-for="entry in knowledgeStore.entries" :key="entry.id"
           class="glass-card" style="padding: 20px; cursor: pointer;"
           @click="openDetail(entry)">
        <!-- 标题行 -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <h4 style="font-size: 16px; font-weight: 600;">{{ entry.title }}</h4>
          <!-- 类型徽章 -->
          <span :style="{
            padding: '2px 10px', borderRadius: '10px', fontSize: '12px',
            background: typeBg(entry.type), color: typeColor(entry.type),
          }">
            {{ typeLabel(entry.type) }}
          </span>
        </div>
        <!-- 内容预览（前 100 字符） -->
        <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.5; margin-bottom: 10px;">
          {{ preview(entry.content) }}
        </p>
        <!-- 底部：日期 + 标签 -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="color: var(--text-secondary); font-size: 12px;">
            {{ formatDate(entry.updated_at || entry.created_at) }}
          </span>
          <span v-if="entry.tags" style="color: var(--text-secondary); font-size: 12px;">
            {{ entry.tags }}
          </span>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detailEntry" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;">
      <div class="glass-card" style="width: 600px; max-height: 80vh; padding: 32px; overflow-y: auto;">
        <!-- 标题 + 关闭 -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <h3 style="font-size: 22px;">{{ detailEntry.title }}</h3>
          <button style="background: transparent; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer;" @click="detailEntry = null">&times;</button>
        </div>
        <!-- 元信息行 -->
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <span :style="{ padding: '2px 10px', borderRadius: '10px', fontSize: '12px', background: typeBg(detailEntry.type), color: typeColor(detailEntry.type) }">
            {{ typeLabel(detailEntry.type) }}
          </span>
          <span v-if="detailEntry.tags" style="color: var(--text-secondary); font-size: 12px;">
            {{ detailEntry.tags }}
          </span>
          <span style="color: var(--text-secondary); font-size: 12px;">
            {{ formatDate(detailEntry.updated_at || detailEntry.created_at) }}
          </span>
        </div>
        <!-- 内容正文 -->
        <div style="color: var(--text-primary); line-height: 1.7; font-size: 15px; white-space: pre-wrap; margin-bottom: 20px;">
          {{ detailEntry.content }}
        </div>
        <!-- 操作按钮 -->
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn-danger" style="padding: 8px 16px; font-size: 13px;" @click="handleDelete(detailEntry.id)">删除</button>
          <button class="btn-primary" style="padding: 8px 16px; font-size: 13px;" @click="openEditDialog(detailEntry)">编辑</button>
        </div>
      </div>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showDialog" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 101;">
      <div class="glass-card" style="width: 560px; padding: 32px;">
        <h3 style="margin-bottom: 20px;">{{ editingEntry ? '编辑条目' : '新建条目' }}</h3>

        <!-- 标题 -->
        <input v-model="form.title" class="auth-input" placeholder="标题" />
        <!-- 类型选择 -->
        <select v-model="form.type" class="auth-input">
          <option value="note">笔记</option>
          <option value="article">文章</option>
          <option value="reference">参考资料</option>
          <option value="snippet">代码片段</option>
        </select>
        <!-- 标签 -->
        <input v-model="form.tags" class="auth-input" placeholder="标签（逗号分隔）" />
        <!-- 内容正文 -->
        <textarea v-model="form.content" class="auth-input" placeholder="内容..."
                  style="min-height: 160px; resize: vertical; font-family: inherit;" />

        <!-- 错误提示 -->
        <p v-if="formError" class="error-text">{{ formError }}</p>

        <!-- 按钮行 -->
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px;">
          <button class="btn-danger" style="padding: 10px 20px;" @click="closeDialog">取消</button>
          <button class="btn-primary" style="padding: 10px 20px;" :disabled="formLoading" @click="handleSubmit">
            {{ formLoading ? '提交中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// KnowledgeView 逻辑 —— 条目加载、搜索、类型筛选、卡片展示、详情弹窗
import { ref, reactive, onMounted } from 'vue'
import { useKnowledgeStore, type KnowledgeEntry } from '@/stores/knowledgeStore'

const knowledgeStore = useKnowledgeStore()

// 搜索关键词
const searchQuery = ref('')

// 类型筛选
const typeTabs = [
  { label: '全部', value: '' },       // 显示全部类型
  { label: '笔记', value: 'note' },    // 筛选笔记
  { label: '文章', value: 'article' },  // 筛选文章
  { label: '参考', value: 'reference' }, // 筛选参考资料
  { label: '代码', value: 'snippet' },  // 筛选代码片段
]
const activeType = ref('')  // 当前激活的类型筛选

// 详情弹窗
const detailEntry = ref<KnowledgeEntry | null>(null)  // 当前查看的条目

// 创建/编辑弹窗
const showDialog = ref(false)              // 是否显示弹窗
const editingEntry = ref<KnowledgeEntry | null>(null)  // 正在编辑的条目
const formLoading = ref(false)             // 表单提交加载
const formError = ref('')                  // 表单错误
const form = reactive({
  title: '',     // 标题
  content: '',   // 内容
  type: 'note',  // 类型，默认笔记
  tags: '',      // 标签
})

// 组件挂载时加载条目
onMounted(async () => {
  await loadEntries()
})

/** 加载条目（支持当前筛选条件） */
async function loadEntries() {
  const params: { type?: string; query?: string } = {}
  if (activeType.value) params.type = activeType.value  // 类型筛选
  if (searchQuery.value.trim()) params.query = searchQuery.value.trim()  // 搜索词
  await knowledgeStore.fetchEntries(params)
}

/** 处理搜索 */
async function handleSearch() {
  await loadEntries()  // 使用当前搜索词重新加载
}

/** 内容预览 —— 截取前 100 字符 */
function preview(content: string): string {
  if (!content) return ''
  return content.length > 100 ? content.slice(0, 100) + '...' : content
}

/** 打开详情弹窗 */
function openDetail(entry: KnowledgeEntry) {
  detailEntry.value = entry
}

/** 打开新建弹窗 */
function openCreateDialog() {
  editingEntry.value = null     // 新建模式
  form.title = ''               // 清空
  form.content = ''
  form.type = 'note'
  form.tags = ''
  formError.value = ''
  showDialog.value = true
}

/** 打开编辑弹窗 */
function openEditDialog(entry: KnowledgeEntry) {
  editingEntry.value = entry    // 编辑模式
  form.title = entry.title      // 回填
  form.content = entry.content
  form.type = entry.type || 'note'
  form.tags = entry.tags || ''
  formError.value = ''
  showDialog.value = true
  detailEntry.value = null      // 关闭详情弹窗
}

/** 关闭弹窗 */
function closeDialog() {
  showDialog.value = false
  editingEntry.value = null
  formError.value = ''
}

/** 提交表单 */
async function handleSubmit() {
  formError.value = ''
  if (!form.title.trim()) {
    formError.value = '请输入标题'
    return
  }
  if (!form.content.trim()) {
    formError.value = '请输入内容'
    return
  }
  formLoading.value = true
  try {
    if (editingEntry.value) {
      // 编辑模式
      await knowledgeStore.updateEntry(editingEntry.value.id, {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        tags: form.tags.trim(),
      })
    } else {
      // 新建模式
      await knowledgeStore.createEntry(
        form.title.trim(),
        form.content.trim(),
        form.type,
        form.tags.trim(),
      )
    }
    closeDialog()
  } catch {
    formError.value = '提交失败，请重试'
  } finally {
    formLoading.value = false
  }
}

/** 删除条目 */
async function handleDelete(entryId: string) {
  if (!confirm('确定删除此条目？')) return
  await knowledgeStore.deleteEntry(entryId)
  detailEntry.value = null  // 关闭详情弹窗
}

// ===== 样式辅助函数 =====

/** 类型背景色 */
function typeBg(t: string): string {
  if (t === 'article') return 'rgba(96,165,250,0.15)'
  if (t === 'reference') return 'rgba(196,181,253,0.15)'
  if (t === 'snippet') return 'rgba(251,146,60,0.15)'
  return 'rgba(52,211,153,0.15)'  // 默认 note
}

/** 类型文字色 */
function typeColor(t: string): string {
  if (t === 'article') return '#60A5FA'
  if (t === 'reference') return '#C4B5FD'
  if (t === 'snippet') return '#FB923C'
  return '#34D399'  // 默认 note
}

/** 类型文本 */
function typeLabel(t: string): string {
  if (t === 'article') return '文章'
  if (t === 'reference') return '参考'
  if (t === 'snippet') return '代码'
  return '笔记'  // 默认 note
}

/** 格式化日期 */
function formatDate(d: string): string {
  if (!d) return ''
  const date = new Date(d)  // 解析 ISO 日期字符串
  const now = new Date()    // 当前时间
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return diffMins + ' 分钟前'
  if (diffMins < 1440) return Math.floor(diffMins / 60) + ' 小时前'
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>
