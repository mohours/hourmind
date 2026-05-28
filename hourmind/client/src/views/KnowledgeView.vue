<!--
  KnowledgeView.vue —— 个人知识库页面
  Quantum Glass 风格，三栏布局：
    左侧：文件夹 + 标签筛选
    中间：文档列表（搜索 + 卡片展示）
    右侧：文档详情 + 知识卡片管理 + 编辑
-->
<template>
  <div class="knowledge-page">
    <!-- ===== 顶部栏 ===== -->
    <div class="toolbar">
      <h2 class="title">知识库</h2>
      <div class="toolbar-actions">
        <input
          v-model="ks.search"
          placeholder="搜索知识..."
          class="search-input"
          @input="onSearchChange"
        />
        <select v-model="ks.typeFilter" class="filter-select" @change="ks.fetchList()">
          <option value="all">全部类型</option>
          <option value="manual">笔记</option>
          <option value="md">Markdown</option>
          <option value="txt">文本</option>
        </select>
        <button class="btn-primary" @click="ks.showCreateDialog = true">+ 新建笔记</button>
      </div>
    </div>

    <!-- ===== 主布局 ===== -->
    <div class="layout">
      <!-- === 左侧筛选面板 === -->
      <div class="side-panel">
        <h4 style="font-size:14px;margin-bottom:12px">文件夹</h4>
        <div class="folder-list">
          <button
            v-for="f in folders"
            :key="f"
            class="folder-btn"
            :class="{ active: ks.folderFilter === f }"
            @click="ks.folderFilter = f; ks.fetchList()"
          >{{ f === 'all' ? '全部文档' : f }}</button>
        </div>
      </div>

      <!-- === 中间文档列表 === -->
      <div class="doc-list">
        <div v-if="ks.loading" class="hint text-muted">加载中...</div>
        <div v-else-if="ks.documents.length === 0" class="hint">
          <p style="font-size:16px">知识库为空</p>
          <p class="text-muted" style="font-size:13px;margin-top:4px">点击"+ 新建笔记"开始记录知识</p>
        </div>
        <div v-else class="cards">
          <div
            v-for="doc in ks.documents"
            :key="doc.id"
            class="glass-card doc-card"
            :class="{ selected: ks.selectedDocId === doc.id }"
            @click="ks.fetchDetail(doc.id)"
          >
            <div class="doc-title">{{ doc.title }}</div>
            <div class="doc-preview text-muted">{{ doc.content?.slice(0, 120) || '空文档' }}</div>
            <div class="doc-meta">
              <span class="type-tag">{{ doc.fileType }}</span>
              <span class="text-muted">{{ doc.cardCount || 0 }} 卡片</span>
              <span class="text-muted">{{ fmtTime(doc.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- === 右侧详情/编辑面板 === -->
      <div v-if="ks.selectedDoc && !ks.detailLoading" class="glass-card detail-panel">
        <!-- 编辑标题 -->
        <input
          v-model="editTitle"
          class="edit-title"
          @blur="saveTitle"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <!-- 编辑内容 -->
        <textarea
          v-model="editContent"
          class="edit-content"
          placeholder="写点内容..."
          @blur="saveContent"
        ></textarea>
        <!-- 操作栏 -->
        <div class="detail-actions">
          <button class="btn-delete" @click="handleDelete">🗑 删除</button>
        </div>
        <!-- 知识卡片列表 -->
        <div class="card-section">
          <h4 style="font-size:14px;margin-bottom:8px">知识卡片（{{ ks.selectedDoc.cards?.length || 0 }}）</h4>
          <div v-for="card in ks.selectedDoc.cards" :key="card.id" class="kc-card" :class="{ pinned: card.isPinned }">
            <div class="kc-title">{{ card.title }}</div>
            <div class="kc-content text-muted">{{ card.content?.slice(0, 100) }}</div>
            <button class="btn-del-sm" @click="ks.deleteCard(card.id)">✕</button>
          </div>
          <!-- 添加卡片 -->
          <div class="add-card">
            <input v-model="newCardTitle" placeholder="卡片标题" />
            <input v-model="newCardContent" placeholder="卡片内容" @keydown.enter="handleAddCard" />
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 新建笔记弹窗 ===== -->
    <div v-if="ks.showCreateDialog" class="modal-overlay" @click.self="ks.showCreateDialog = false">
      <div class="glass-card modal-card">
        <h3>新建笔记</h3>
        <input v-model="newTitle" placeholder="笔记标题" />
        <textarea v-model="newContent" placeholder="内容（支持 Markdown）" rows="6"></textarea>
        <input v-model="newFolder" placeholder="文件夹（可选）" />
        <div class="modal-btns">
          <button class="btn-cancel" @click="ks.showCreateDialog = false">取消</button>
          <button class="btn-primary" :disabled="!newTitle.trim()" @click="handleCreate">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledgeStore'

const ks = useKnowledgeStore()

// 编辑状态
const editTitle = ref('')
const editContent = ref('')
const newCardTitle = ref('')
const newCardContent = ref('')
const newTitle = ref('')
const newContent = ref('')
const newFolder = ref('')

// 从文档列表提取去重文件夹名
const folders = computed(() => {
  const set = new Set<string>(['all'])
  ks.documents.forEach(d => { if (d.folder) set.add(d.folder) })
  return Array.from(set)
})

// 选中文档变化时同步编辑状态
watch(() => ks.selectedDoc, (doc) => {
  if (doc) {
    editTitle.value = doc.title
    editContent.value = doc.content || ''
  }
})

// 防抖搜索
let searchTimer: ReturnType<typeof setTimeout>
function onSearchChange() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => ks.fetchList(), 300)
}

// 保存标题
function saveTitle() {
  if (ks.selectedDocId && editTitle.value.trim()) {
    ks.updateDoc(ks.selectedDocId, { title: editTitle.value.trim() })
  }
}

// 保存内容
function saveContent() {
  if (ks.selectedDocId) {
    ks.updateDoc(ks.selectedDocId, { content: editContent.value })
  }
}

// 删除文档
async function handleDelete() {
  if (ks.selectedDocId && confirm('确定删除这个文档？')) {
    await ks.deleteDoc(ks.selectedDocId)
  }
}

// 添加卡片
async function handleAddCard() {
  if (!ks.selectedDocId || !newCardTitle.value.trim()) return
  await ks.createCard(ks.selectedDocId, {
    title: newCardTitle.value.trim(),
    content: newCardContent.value.trim(),
  })
  newCardTitle.value = ''
  newCardContent.value = ''
}

// 创建笔记
async function handleCreate() {
  if (!newTitle.value.trim()) return
  await ks.createNote({
    title: newTitle.value.trim(),
    content: newContent.value,
    folder: newFolder.value.trim() || undefined,
  })
  newTitle.value = ''
  newContent.value = ''
  newFolder.value = ''
  ks.showCreateDialog = false
  ks.fetchList()
}

// 格式化时间
function fmtTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// 页面加载
onMounted(() => ks.fetchList())
</script>

<style scoped>
.knowledge-page {
  padding: 36px 40px; height: 100%; overflow-y: auto; display: flex; flex-direction: column;
}

/* ===== 顶部栏 ===== */
.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
}
.title { font-size: 24px; font-weight: 700; }
.toolbar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.search-input { width: 220px; padding: 8px 14px; }
.filter-select { padding: 8px 14px; }

/* ===== 三栏布局 ===== */
.layout { display: flex; gap: 20px; flex: 1; min-height: 0; }

/* === 左侧 === */
.side-panel { width: 180px; flex-shrink: 0; padding-top: 4px; }
.folder-list { display: flex; flex-direction: column; gap: 4px; }
.folder-btn {
  text-align: left; padding: 8px 12px; background: transparent;
  border: none; border-radius: 8px; color: #94A3B8; cursor: pointer; font-size: 13px;
  transition: all 0.2s;
}
.folder-btn:hover { background: rgba(0,229,216,0.06); color: #F1F5F9; }
.folder-btn.active { background: rgba(0,229,216,0.1); color: #00E5D8; font-weight: 600; }

/* === 中间 === */
.doc-list { flex: 1; min-width: 0; overflow-y: auto; }
.cards { display: flex; flex-direction: column; gap: 8px; }

.doc-card {
  padding: 14px 18px; cursor: pointer; transition: all 0.2s;
  display: flex; flex-direction: column; gap: 6px;
}
.doc-card:hover { border-color: rgba(0,229,216,0.3); }
.doc-card.selected { border-color: rgba(0,229,216,0.5); background: rgba(0,229,216,0.04); }

.doc-title { font-size: 15px; font-weight: 600; color: #F1F5F9; }
.doc-preview { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-meta { display: flex; gap: 12px; font-size: 12px; align-items: center; }
.type-tag {
  padding: 2px 8px; border-radius: 6px; font-size: 11px;
  background: rgba(0,229,216,0.1); color: #00E5D8; font-weight: 600;
}

/* === 右侧 === */
.detail-panel {
  width: 360px; flex-shrink: 0; padding: 20px;
  display: flex; flex-direction: column; gap: 12px; overflow-y: auto;
}
.edit-title {
  font-size: 18px; font-weight: 600; padding: 8px 12px;
  background: transparent; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; color: #F1F5F9;
}
.edit-title:focus { border-color: #00E5D8; }
.edit-content {
  min-height: 180px; resize: vertical; font-size: 13px; padding: 10px;
  line-height: 1.6;
}
.detail-actions { display: flex; gap: 8px; }
.btn-delete {
  padding: 8px 14px; background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2); border-radius: 10px;
  color: #EF4444; cursor: pointer; font-size: 13px;
}

/* 卡片 */
.card-section { margin-top: 12px; }
.kc-card {
  padding: 10px 12px; margin-bottom: 6px;
  background: rgba(255,255,255,0.03); border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.05); position: relative;
}
.kc-card.pinned { border-color: rgba(0,229,216,0.2); }
.kc-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
.kc-content { font-size: 12px; }
.btn-del-sm {
  position: absolute; top: 6px; right: 8px;
  width: 20px; height: 20px; line-height: 20px; text-align: center;
  background: transparent; border: none; color: #64748B;
  cursor: pointer; border-radius: 4px; font-size: 10px;
}
.btn-del-sm:hover { background: rgba(239,68,68,0.15); color: #EF4444; }

.add-card { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.add-card input { padding: 8px 10px; font-size: 13px; }

/* 弹窗 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px); display: flex;
  align-items: center; justify-content: center; z-index: 1000;
}
.modal-card { width: 560px; padding: 28px; display: flex; flex-direction: column; gap: 14px; }
.modal-card h3 { font-size: 18px; font-weight: 600; }
.modal-btns { display: flex; gap: 12px; justify-content: flex-end; }
.btn-cancel {
  background: transparent; border: 1px solid rgba(148,163,184,0.3);
  color: #94A3B8; border-radius: 10px; padding: 10px 20px; cursor: pointer;
}
.btn-cancel:hover { border-color: #F1F5F9; color: #F1F5F9; }

.hint { text-align: center; padding: 60px 20px; }
</style>
