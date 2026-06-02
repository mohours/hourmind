# HourMind 阶段 7 — 知识库 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现个人知识库模块，支持文档/卡片的创建、编辑、删除、搜索，以及类型筛选和详情查看。

**Architecture:** Python FastAPI 后端 (port 8000) + Vue 3 + Vite 前端 (port 5173)，后端用 sqlite3 原生驱动，前端用 Pinia + Vue Router。JWT 认证已在阶段 2 实现，所有接口使用 `require_auth` 依赖。

**Tech Stack:** Python 3.12, FastAPI, uvicorn, sqlite3 / Vue 3, TypeScript, Vite 5, Pinia, Vue Router

---

### Task 1: 知识库后端 API

**Files:**
- Create: `server/routes/knowledge.py`
- Modify: `server/main.py`

- [ ] **Step 1: 创建 knowledge.py**

```python
# server/routes/knowledge.py
# 知识库 API —— 文档/卡片 CRUD + 搜索
from fastapi import APIRouter, Depends, Query, Body
from database import get_db
from routes.auth import require_auth
import uuid

router = APIRouter(prefix="/api", tags=["knowledge"])


@router.get("/knowledge")
def list_knowledge(
    type: str = Query(""),
    search: str = Query(""),
    user_id: str = Depends(require_auth),
):
    """查询知识库列表 —— 支持按类型和关键词搜索"""
    db = get_db()

    conditions = []
    params = []

    if type:
        conditions.append("type = ?")
        params.append(type)

    if search:
        conditions.append("(title LIKE ? OR content LIKE ?)")
        params.append(f"%{search}%")
        params.append(f"%{search}%")

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    rows = db.execute(
        f"""SELECT id, title, summary, type, tags_json, created_at, updated_at
            FROM knowledge
            {where_clause}
            ORDER BY updated_at DESC"""
    ).fetchall()

    documents = []
    for row in rows:
        documents.append({
            "id": row["id"],
            "title": row["title"],
            "summary": row["summary"],
            "type": row["type"],
            "tags_json": row["tags_json"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        })

    db.close()
    return {"documents": documents}


@router.get("/knowledge/{doc_id}")
def get_knowledge_detail(
    doc_id: str,
    user_id: str = Depends(require_auth),
):
    """获取知识文档详情（含完整 content）"""
    db = get_db()

    row = db.execute(
        "SELECT * FROM knowledge WHERE id = ?",
        (doc_id,)
    ).fetchone()

    if not row:
        db.close()
        return {"success": False, "error": "文档不存在"}

    doc = {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "summary": row["summary"],
        "type": row["type"],
        "tags_json": row["tags_json"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }

    db.close()
    return {"document": doc}


@router.post("/knowledge")
def create_knowledge(
    body: dict = Body(...),
    user_id: str = Depends(require_auth),
):
    """创建新知识文档/卡片"""
    db = get_db()
    doc_id = str(uuid.uuid4())

    # 自动生成摘要（取 content 前 120 个字符）
    content = body.get("content", "")
    summary = content[:120] + ("..." if len(content) > 120 else "")

    db.execute(
        """INSERT INTO knowledge (id, title, content, summary, type, tags_json)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            doc_id,
            body.get("title", ""),
            content,
            summary,
            body.get("type", "document"),
            body.get("tags_json", "[]"),
        )
    )
    db.commit()
    db.close()

    return {"success": True, "id": doc_id, "summary": summary}


@router.put("/knowledge/{doc_id}")
def update_knowledge(
    doc_id: str,
    body: dict = Body(...),
    user_id: str = Depends(require_auth),
):
    """更新知识文档"""
    db = get_db()

    allowed_fields = ["title", "content", "summary", "type", "tags_json"]
    set_parts = []
    params = []

    for field in allowed_fields:
        if field in body:
            set_parts.append(f"{field} = ?")
            params.append(body[field])

    # 如果更新了 content 但没传 summary，自动重新生成摘要
    if "content" in body and "summary" not in body:
        content = body["content"]
        summary = content[:120] + ("..." if len(content) > 120 else "")
        set_parts.append("summary = ?")
        params.append(summary)

    if not set_parts:
        db.close()
        return {"success": False, "error": "没有要更新的字段"}

    set_parts.append("updated_at = datetime('now')")
    params.append(doc_id)

    db.execute(
        f"UPDATE knowledge SET {', '.join(set_parts)} WHERE id = ?",
        params
    )
    db.commit()
    db.close()

    return {"success": True}


@router.delete("/knowledge/{doc_id}")
def delete_knowledge(
    doc_id: str,
    user_id: str = Depends(require_auth),
):
    """删除知识文档"""
    db = get_db()
    db.execute("DELETE FROM knowledge WHERE id = ?", (doc_id,))
    db.commit()
    db.close()

    return {"success": True, "message": "文档已删除"}
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
from routes.knowledge import router as knowledge_router
app.include_router(knowledge_router)
```

- [ ] **Step 3: 验证后端 API**

```bash
cd server
source venv/bin/activate
python main.py &
```

```bash
# 创建文档
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"title":"Vue 3 组合式 API 笔记","content":"setup() 函数是组合式 API 的入口...","type":"document"}' \
  http://localhost:8000/api/knowledge

# 查询列表
curl -H "Authorization: Bearer <token>" "http://localhost:8000/api/knowledge?search=Vue&type=document"

# 查询详情
curl -H "Authorization: Bearer <token>" "http://localhost:8000/api/knowledge/<doc_id>"

# 更新
curl -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"title":"Vue 3 组合式 API 详解"}' \
  http://localhost:8000/api/knowledge/<doc_id>
```

- [ ] **Step 4: 提交**

```bash
git add server/routes/knowledge.py server/main.py
git commit -m "feat: 知识库后端 API —— 文档 CRUD + 关键词搜索 + 自动摘要"
```

---

### Task 2: 知识库前端 Store

**Files:**
- Create: `client/src/stores/knowledgeStore.ts`

- [ ] **Step 1: 创建 knowledgeStore.ts**

```typescript
// client/src/stores/knowledgeStore.ts
// 知识库状态管理 —— 文档列表、详情、搜索、类型筛选
import { defineStore } from 'pinia'
import { ref } from 'vue'

// 知识文档接口（列表项，不含完整 content）
export interface KnowledgeDoc {
  id: string
  title: string
  summary: string | null
  type: string
  tags_json: string
  created_at: string
  updated_at: string
}

// 知识文档详情接口（含完整 content）
export interface KnowledgeDetail extends KnowledgeDoc {
  content: string
}

// API 基础请求函数
async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token') || ''
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`请求失败: ${url}`)
  return res.json()
}

export const useKnowledgeStore = defineStore('knowledge', () => {
  // --- 状态 ---
  const documents = ref<KnowledgeDoc[]>([])        // 文档列表
  const selectedDoc = ref<KnowledgeDetail | null>(null) // 当前选中的文档详情
  const search = ref('')                            // 搜索关键词
  const typeFilter = ref('')                        // 类型筛选（全部/document/card）
  const loading = ref(false)                        // 加载状态
  const detailLoading = ref(false)                  // 详情加载状态

  // --- 操作 ---

  /** fetchList —— 查询知识文档列表 */
  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (typeFilter.value) params.set('type', typeFilter.value)
      if (search.value) params.set('search', search.value)
      const data = await apiFetch(`/api/knowledge?${params}`)
      documents.value = data.documents
    } finally {
      loading.value = false
    }
  }

  /** fetchDetail —— 获取文档完整内容和更新列表中的位置 */
  async function fetchDetail(docId: string): Promise<void> {
    detailLoading.value = true
    try {
      const data = await apiFetch(`/api/knowledge/${docId}`)
      if (data.document) {
        selectedDoc.value = data.document

        // 同步更新列表中的摘要（可能已被后端自动更新）
        const idx = documents.value.findIndex(d => d.id === docId)
        if (idx !== -1) {
          documents.value[idx] = {
            ...documents.value[idx],
            summary: data.document.summary,
            updated_at: data.document.updated_at,
          }
        }
      }
    } finally {
      detailLoading.value = false
    }
  }

  /** createDoc —— 创建新文档 */
  async function createDoc(doc: {
    title: string; content: string; type: string; tags_json?: string
  }): Promise<string | null> {
    const data = await apiFetch('/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(doc),
    })
    if (data.success) {
      await fetchList()
      return data.id
    }
    return null
  }

  /** updateDoc —— 更新文档 */
  async function updateDoc(
    docId: string,
    updates: Record<string, any>
  ): Promise<boolean> {
    const data = await apiFetch(`/api/knowledge/${docId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    if (data.success) {
      // 刷新详情
      if (selectedDoc.value?.id === docId) {
        await fetchDetail(docId)
      }
      await fetchList()
    }
    return data.success
  }

  /** deleteDoc —— 删除文档 */
  async function deleteDoc(docId: string): Promise<boolean> {
    const data = await apiFetch(`/api/knowledge/${docId}`, { method: 'DELETE' })
    if (data.success) {
      documents.value = documents.value.filter(d => d.id !== docId)
      if (selectedDoc.value?.id === docId) {
        selectedDoc.value = null
      }
    }
    return data.success
  }

  /** selectDoc —— 选中文档并加载详情 */
  function selectDoc(docId: string): void {
    fetchDetail(docId)
  }

  /** deselectDoc —— 取消选中 */
  function deselectDoc(): void {
    selectedDoc.value = null
  }

  return {
    documents, selectedDoc, search, typeFilter, loading, detailLoading,
    fetchList, fetchDetail, createDoc, updateDoc, deleteDoc,
    selectDoc, deselectDoc,
  }
})
```

- [ ] **Step 2: 提交**

```bash
git add client/src/stores/knowledgeStore.ts
git commit -m "feat: 知识库前端 Store —— 文档列表 + 详情 + 搜索筛选"
```

---

### Task 3: 知识库视图

**Files:**
- Create: `client/src/views/KnowledgeView.vue`
- Create: `client/src/components/KnowledgeDialog.vue`
- Modify: `client/src/router.ts`

- [ ] **Step 1: 创建 KnowledgeDialog.vue 组件**

```vue
<!-- client/src/components/KnowledgeDialog.vue -->
<!-- 新建/编辑知识文档弹窗 -->
<template>
  <div class="dialog-overlay" v-if="visible" @click.self="$emit('close')">
    <div class="glass-card dialog-content">
      <h2 class="dialog-title">{{ editing ? '编辑文档' : '新建文档' }}</h2>

      <div class="form-group">
        <label>标题</label>
        <input
          v-model="form.title"
          type="text"
          placeholder="输入标题..."
          class="glass-input"
          ref="titleInput"
        />
      </div>

      <div class="form-group">
        <label>类型</label>
        <select v-model="form.type" class="glass-select">
          <option value="document">文档</option>
          <option value="card">卡片</option>
        </select>
      </div>

      <div class="form-group">
        <label>内容</label>
        <textarea
          v-model="form.content"
          placeholder="输入内容（支持 Markdown）..."
          class="glass-textarea"
          rows="10"
        ></textarea>
      </div>

      <div class="dialog-actions">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button class="btn-primary" @click="onSubmit" :disabled="!form.title.trim()">
          {{ editing ? '保存' : '创建' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 知识文档弹窗组件 —— 支持新建和编辑两种模式
import { ref, reactive, watch, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
  editing?: boolean
  initialData?: { title: string; content: string; type: string }
}>()
const emit = defineEmits<{
  close: []
  submit: [doc: { title: string; content: string; type: string }]
}>()

const titleInput = ref<HTMLInputElement | null>(null)

const form = reactive({
  title: '',
  content: '',
  type: 'document',
})

// 弹窗打开时填充数据并聚焦
watch(() => props.visible, async (v) => {
  if (v) {
    if (props.initialData) {
      form.title = props.initialData.title
      form.content = props.initialData.content
      form.type = props.initialData.type
    } else {
      form.title = ''
      form.content = ''
      form.type = 'document'
    }
    await nextTick()
    titleInput.value?.focus()
  }
})

function onSubmit(): void {
  if (!form.title.trim()) return
  emit('submit', { ...form })
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; backdrop-filter: blur(4px);
}
.dialog-content { width: 560px; max-width: 90vw; padding: 28px; max-height: 85vh; overflow-y: auto; }
.dialog-title { font-size: 20px; margin-bottom: 20px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.glass-input, .glass-textarea, .glass-select {
  width: 100%; padding: 10px 14px;
  background: rgba(10,12,18,0.6); color: var(--text-primary);
  border: 1px solid var(--border-glow); border-radius: 10px;
  font-size: 14px; outline: none;
}
.glass-textarea { resize: vertical; font-family: 'Fira Code', 'Courier New', monospace; line-height: 1.6; }
.glass-select { cursor: pointer; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
.btn-cancel { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; padding: 10px 20px; font-size: 14px; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: 创建 KnowledgeView.vue**

```vue
<!-- client/src/views/KnowledgeView.vue -->
<!-- 知识库页面 —— 类型筛选 + 文档列表 + 详情面板 -->
<template>
  <div class="knowledge-page">
    <!-- 顶部标题栏 -->
    <div class="knowledge-header">
      <h1 class="page-title">个人知识库</h1>
      <div class="header-actions">
        <input
          v-model="store.search"
          type="text"
          placeholder="搜索文档..."
          class="glass-input search-input"
          @input="onSearch"
        />
        <button class="btn-primary" @click="showDialog = true">+ 新建</button>
      </div>
    </div>

    <!-- 类型标签页 -->
    <div class="type-tabs glass-card">
      <button
        v-for="tab in typeTabs"
        :key="tab.value"
        :class="{ active: store.typeFilter === tab.value }"
        @click="onTypeChange(tab.value)"
      >{{ tab.label }}</button>
    </div>

    <!-- 主内容区 -->
    <div class="knowledge-content" :class="{ 'has-detail': store.selectedDoc }">
      <!-- 文档列表 -->
      <div class="doc-list">
        <div
          v-for="doc in store.documents"
          :key="doc.id"
          class="glass-card doc-card"
          :class="{ selected: store.selectedDoc?.id === doc.id }"
          @click="store.selectDoc(doc.id)"
        >
          <div class="doc-card-header">
            <span class="doc-type-badge" :class="`type-${doc.type}`">
              {{ doc.type === 'card' ? '卡片' : '文档' }}
            </span>
            <span class="doc-time">{{ formatTime(doc.updated_at) }}</span>
          </div>
          <h3 class="doc-title">{{ doc.title }}</h3>
          <p class="doc-summary" v-if="doc.summary">{{ doc.summary }}</p>
          <div class="doc-tags" v-if="docTags(doc.tags_json).length > 0">
            <span class="doc-tag" v-for="tag in docTags(doc.tags_json)" :key="tag">
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="empty-state" v-if="!store.loading && store.documents.length === 0">
          <p>知识库为空，点击"+ 新建"添加第一条文档</p>
        </div>
      </div>

      <!-- 右侧详情面板 -->
      <div class="detail-panel glass-card" v-if="store.selectedDoc && !store.detailLoading">
        <div class="detail-header">
          <h2>{{ store.selectedDoc.title }}</h2>
          <button class="close-btn" @click="store.deselectDoc()">&times;</button>
        </div>

        <!-- 元信息 -->
        <div class="detail-meta">
          <span class="doc-type-badge" :class="`type-${store.selectedDoc.type}`">
            {{ store.selectedDoc.type === 'card' ? '卡片' : '文档' }}
          </span>
          <span class="detail-date">更新于 {{ formatTime(store.selectedDoc.updated_at) }}</span>
        </div>

        <!-- 正文内容 -->
        <div class="detail-content" v-html="renderedContent"></div>

        <!-- 操作按钮 -->
        <div class="detail-actions">
          <button class="btn-primary" @click="onEdit">编辑</button>
          <button class="btn-danger" @click="onDelete">删除</button>
        </div>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <KnowledgeDialog
      :visible="showDialog"
      :editing="isEditing"
      :initial-data="editData"
      @close="onCloseDialog"
      @submit="onSubmitDoc"
    />
  </div>
</template>

<script setup lang="ts">
// 知识库视图组件 —— 文档列表 + 类型筛选 + 详情面板
import { ref, computed, onMounted } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import KnowledgeDialog from '@/components/KnowledgeDialog.vue'
import { marked } from 'marked'

const store = useKnowledgeStore()
const showDialog = ref(false)
const isEditing = ref(false)
const editData = ref<{ title: string; content: string; type: string } | undefined>()

// 类型标签页配置
const typeTabs = [
  { label: '全部', value: '' },
  { label: '文档', value: 'document' },
  { label: '卡片', value: 'card' },
]

let searchTimer: ReturnType<typeof setTimeout> | null = null

/** renderedContent —— 将 Markdown 内容渲染为 HTML */
const renderedContent = computed(() => {
  if (!store.selectedDoc?.content) return '<p style="color:var(--text-secondary)">暂无内容</p>'
  try {
    return marked.parse(store.selectedDoc.content) as string
  } catch {
    return store.selectedDoc.content
  }
})

/** docTags —— 解析 tags_json 为字符串数组 */
function docTags(tagsJson: string): string[] {
  try { return JSON.parse(tagsJson || '[]') } catch { return [] }
}

/** formatTime —— 格式化时间戳为相对时间 */
function formatTime(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

/** onSearch —— 防抖搜索 */
function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { store.fetchList() }, 300)
}

/** onTypeChange —— 切换类型筛选 */
function onTypeChange(value: string): void {
  store.typeFilter = value
  store.fetchList()
}

/** onEdit —— 编辑当前选中文档 */
function onEdit(): void {
  if (!store.selectedDoc) return
  isEditing.value = true
  editData.value = {
    title: store.selectedDoc.title,
    content: store.selectedDoc.content,
    type: store.selectedDoc.type,
  }
  showDialog.value = true
}

/** onSubmitDoc —— 提交新建/编辑文档 */
async function onSubmitDoc(doc: { title: string; content: string; type: string }): Promise<void> {
  if (isEditing.value && editData.value) {
    // 编辑模式
    await store.updateDoc(store.selectedDoc!.id, doc)
  } else {
    // 新建模式
    await store.createDoc(doc)
  }
  showDialog.value = false
  isEditing.value = false
  editData.value = undefined
}

/** onCloseDialog —— 关闭弹窗并重置状态 */
function onCloseDialog(): void {
  showDialog.value = false
  isEditing.value = false
  editData.value = undefined
}

/** onDelete —— 删除当前文档 */
async function onDelete(): Promise<void> {
  if (!store.selectedDoc) return
  if (!confirm(`确认删除"${store.selectedDoc.title}"？此操作不可恢复。`)) return
  await store.deleteDoc(store.selectedDoc.id)
}

onMounted(() => { store.fetchList() })
</script>

<style scoped>
.knowledge-page { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }

/* 顶部标题栏 */
.knowledge-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 24px; font-weight: 700; }
.header-actions { display: flex; gap: 12px; align-items: center; }
.search-input { width: 240px; padding: 9px 14px; color: var(--text-primary); background: var(--glass-bg); border: 1px solid var(--border-glow); border-radius: 10px; outline: none; font-size: 14px; }
.search-input::placeholder { color: var(--text-secondary); }

/* 类型标签页 */
.type-tabs { display: flex; gap: 4px; padding: 6px; margin-bottom: 20px; }
.type-tabs button {
  padding: 8px 20px; font-size: 14px;
  background: transparent; color: var(--text-secondary);
  border: none; border-radius: 10px; cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.type-tabs button.active { background: rgba(0, 229, 216, 0.15); color: var(--accent); }
.type-tabs button:hover:not(.active) { color: var(--text-primary); }

/* 主内容区 */
.knowledge-content { display: flex; gap: 24px; }
.knowledge-content.has-detail .doc-list { flex: 1; }
.doc-list { flex: 1; display: flex; flex-direction: column; gap: 12px; }
.empty-state { text-align: center; padding: 60px 0; color: var(--text-secondary); font-size: 15px; }

/* 文档卡片 */
.doc-card { padding: 20px; cursor: pointer; transition: border-color 0.2s; }
.doc-card.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.doc-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.doc-type-badge { font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
.type-document { background: rgba(196, 181, 253, 0.15); color: var(--accent-purple); }
.type-card { background: rgba(0, 229, 216, 0.12); color: var(--accent); }
.doc-time { font-size: 12px; color: var(--text-secondary); }
.doc-title { font-size: 17px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-summary { font-size: 13px; color: var(--text-secondary); margin-top: 6px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.doc-tags { display: flex; gap: 6px; margin-top: 10px; }
.doc-tag { font-size: 11px; background: rgba(148, 163, 184, 0.1); color: var(--text-secondary); padding: 2px 8px; border-radius: 6px; }

/* 右侧详情面板 */
.detail-panel { width: 400px; padding: 24px; flex-shrink: 0; align-self: flex-start; position: sticky; top: 24px; max-height: calc(100vh - 80px); overflow-y: auto; }
.detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.detail-header h2 { font-size: 18px; }
.close-btn { background: transparent; border: none; color: var(--text-secondary); font-size: 22px; cursor: pointer; line-height: 1; }
.detail-meta { display: flex; gap: 12px; align-items: center; margin-bottom: 20px; }
.detail-date { font-size: 12px; color: var(--text-secondary); }

/* 正文内容渲染 */
.detail-content { font-size: 14px; line-height: 1.8; color: var(--text-primary); margin-bottom: 24px; }
.detail-content :deep(h1), .detail-content :deep(h2), .detail-content :deep(h3) {
  margin-top: 16px; margin-bottom: 8px; color: var(--accent);
}
.detail-content :deep(p) { margin-bottom: 10px; }
.detail-content :deep(code) {
  background: rgba(0, 229, 216, 0.08); color: var(--accent);
  padding: 2px 6px; border-radius: 4px; font-size: 13px;
}
.detail-content :deep(pre) {
  background: rgba(10, 12, 18, 0.6); border: 1px solid var(--border-glow);
  border-radius: 10px; padding: 16px; overflow-x: auto; margin: 10px 0;
}
.detail-content :deep(pre code) { background: transparent; padding: 0; }

.detail-actions { display: flex; gap: 12px; }
</style>
```

- [ ] **Step 3: 更新 router.ts**

```typescript
{ path: '/knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeView.vue') },
```

- [ ] **Step 4: 启动前端验证**

```bash
cd client
npm run dev
```

访问 `http://localhost:5173/#/knowledge` 应看到知识库页面，包含类型标签页、文档卡片列表、搜索框、新建弹窗、详情面板（含 Markdown 渲染）。

- [ ] **Step 5: 提交**

```bash
git add client/src/components/KnowledgeDialog.vue client/src/views/KnowledgeView.vue client/src/router.ts
git commit -m "feat: 知识库视图 —— 文档/卡片列表 + 类型筛选 + Markdown 详情 + 新建/编辑"
```

---

## 阶段 7 完成检查清单

- [ ] `GET /api/knowledge` 支持 `?type=document&search=keyword` 搜索和筛选
- [ ] `GET /api/knowledge/{id}` 返回完整文档内容
- [ ] `POST /api/knowledge` 创建文档并自动生成摘要（前 120 字符）
- [ ] `PUT /api/knowledge/{id}` 更新文档，content 变更时自动更新摘要
- [ ] `DELETE /api/knowledge/{id}` 删除文档
- [ ] 知识库页面显示类型标签页（全部/文档/卡片）
- [ ] 文档卡片列表显示标题、摘要预览、标签、更新时间
- [ ] 搜索框支持防抖关键词搜索
- [ ] 右侧详情面板展示完整 Markdown 渲染内容、元信息和编辑/删除按钮
- [ ] 新建/编辑弹窗含标题、类型选择、Markdown 内容三个字段
