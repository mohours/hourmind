<!--
  TasksView.vue —— 个人待办事项页面
  Quantum Glass 风格，两栏布局：
    左侧：筛选栏 + 任务卡片列表（支持勾选、展开子任务）
    右侧：选中任务的详情面板（编辑/子任务管理/AI 拆解）
-->
<template>
  <div class="tasks-page">
    <!-- ===== 顶部栏 ===== -->
    <div class="toolbar">
      <h2 class="title">待办事项</h2>
      <div class="toolbar-actions">
        <!-- 优先级筛选 -->
        <select v-model="ts.priorityFilter" class="filter-select" @change="ts.fetchTasks()">
          <option value="all">全部优先级</option>
          <option value="high">高优先级</option>
          <option value="medium">中优先级</option>
          <option value="low">低优先级</option>
        </select>
        <!-- 状态筛选 -->
        <select v-model="ts.statusFilter" class="filter-select" @change="ts.fetchTasks()">
          <option value="all">全部状态</option>
          <option value="todo">待办</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
          <option value="archived">已归档</option>
        </select>
        <button class="btn-primary" @click="ts.showCreateDialog = true">+ 新建任务</button>
      </div>
    </div>

    <!-- ===== 主布局 ===== -->
    <div class="layout">
      <!-- === 左侧任务列表 === -->
      <div class="task-list">
        <!-- 加载/空状态 -->
        <div v-if="ts.loading" class="hint text-muted">加载中...</div>
        <div v-else-if="ts.filteredTasks().length === 0" class="hint">
          <p style="font-size:16px">暂无任务</p>
          <p class="text-muted" style="font-size:13px;margin-top:4px">点击"+ 新建任务"开始</p>
        </div>

        <!-- 任务卡片 -->
        <div v-else class="cards">
          <div
            v-for="task in ts.filteredTasks()"
            :key="task.id"
            class="glass-card task-card"
            :class="{ selected: ts.selectedTaskId === task.id }"
            @click="ts.selectedTaskId = task.id"
          >
            <!-- 勾选 + 标题 -->
            <div class="task-header">
              <input
                type="checkbox"
                class="task-checkbox"
                :checked="task.status === 'done'"
                @click.stop="ts.toggleTask(task.id)"
              />
              <span class="task-title" :class="{ done: task.status === 'done' }">
                {{ task.title }}
              </span>
            </div>
            <!-- 元数据 -->
            <div class="task-meta">
              <span :class="['pri-badge', task.priority]">
                {{ task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低' }}
              </span>
              <span class="text-muted" v-if="task.dueDate">{{ fmtDate(task.dueDate) }}</span>
              <span class="text-muted">{{ task.subtasks?.length || 0 }} 个子任务</span>
            </div>
            <!-- 子任务进度条 -->
            <div v-if="task.subtasks?.length" class="sub-progress">
              <div
                class="sub-progress-bar"
                :style="{ width: subProgress(task) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- === 右侧详情面板 === -->
      <div v-if="ts.selectedTaskId" class="glass-card detail-panel">
        <template v-if="selectedTask">
          <!-- 编辑标题 -->
          <input
            v-model="editTitle"
            class="edit-title"
            @blur="saveTitle"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
          <!-- 编辑描述 -->
          <textarea
            v-model="editDesc"
            class="edit-desc"
            placeholder="添加描述..."
            @blur="saveDesc"
          ></textarea>
          <!-- 操作行 -->
          <div class="detail-actions">
            <!-- 优先级 -->
            <select v-model="editPriority" class="filter-select" @change="ts.updateTask(ts.selectedTaskId!, { priority: editPriority })">
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </select>
            <!-- 状态 -->
            <select v-model="editStatus" class="filter-select" @change="ts.setTaskStatus(ts.selectedTaskId!, editStatus)">
              <option value="todo">待办</option>
              <option value="in_progress">进行中</option>
              <option value="done">已完成</option>
              <option value="archived">归档</option>
            </select>
            <!-- AI 拆解 -->
            <button
              class="btn-decompose"
              :disabled="ts.isDecomposing"
              @click="ts.decomposeTask(ts.selectedTaskId!)"
            >
              {{ ts.isDecomposing ? '拆解中...' : '✨ AI 拆解' }}
            </button>
            <!-- 删除 -->
            <button class="btn-delete" @click="handleDelete">🗑</button>
          </div>
          <!-- 子任务列表 -->
          <div class="subtask-section" v-if="selectedTask.subtasks?.length">
            <h4 style="font-size:14px;margin-bottom:8px">子步骤</h4>
            <div v-for="st in selectedTask.subtasks" :key="st.id" class="subtask-row">
              <input
                type="checkbox"
                :checked="st.isCompleted"
                @change="ts.toggleSubtask(st.id)"
              />
              <span :class="{ done: st.isCompleted }">{{ st.title }}</span>
              <button class="btn-del-sub" @click="ts.deleteSubtask(st.id)">✕</button>
            </div>
          </div>
          <!-- 添加子任务 -->
          <div class="add-subtask">
            <input
              v-model="newSubtaskTitle"
              placeholder="添加子步骤..."
              @keydown.enter="handleAddSubtask"
            />
          </div>
        </template>
      </div>
    </div>

    <!-- ===== 新建任务弹窗 ===== -->
    <div v-if="ts.showCreateDialog" class="modal-overlay" @click.self="ts.showCreateDialog = false">
      <div class="glass-card modal-card">
        <h3>新建任务</h3>
        <input v-model="newTaskTitle" placeholder="任务标题" />
        <textarea v-model="newTaskDesc" placeholder="描述（可选）" rows="2"></textarea>
        <div class="modal-actions">
          <select v-model="newTaskPriority">
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </select>
          <input v-model="newTaskDueDate" type="date" />
        </div>
        <div class="modal-btns">
          <button class="btn-cancel" @click="ts.showCreateDialog = false">取消</button>
          <button class="btn-primary" :disabled="!newTaskTitle.trim()" @click="handleCreate">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/stores/taskStore'

const ts = useTaskStore()

// 编辑状态（本地缓存，编辑完成才提交）
const editTitle = ref('')
const editDesc = ref('')
const editPriority = ref('medium')
const editStatus = ref('todo')
const newSubtaskTitle = ref('')
const newTaskTitle = ref('')
const newTaskDesc = ref('')
const newTaskPriority = ref('medium')
const newTaskDueDate = ref('')

// 当前选中的任务
const selectedTask = computed(() => ts.tasks.find(t => t.id === ts.selectedTaskId))

// 选中任务变化时，同步编辑状态
import { watch } from 'vue'
watch(() => ts.selectedTaskId, (id) => {
  const t = ts.tasks.find(t => t.id === id)
  if (t) {
    editTitle.value = t.title
    editDesc.value = t.description || ''
    editPriority.value = t.priority
    editStatus.value = t.status
  }
})

// 保存标题
function saveTitle() {
  if (ts.selectedTaskId && editTitle.value.trim()) {
    ts.updateTask(ts.selectedTaskId, { title: editTitle.value.trim() })
  }
}

// 保存描述
function saveDesc() {
  if (ts.selectedTaskId) {
    ts.updateTask(ts.selectedTaskId, { description: editDesc.value })
  }
}

// 添加子任务
async function handleAddSubtask() {
  if (!ts.selectedTaskId || !newSubtaskTitle.value.trim()) return
  await ts.addSubtask(ts.selectedTaskId, newSubtaskTitle.value.trim())
  newSubtaskTitle.value = ''
}

// 删除任务
async function handleDelete() {
  if (ts.selectedTaskId && confirm('确定删除这个任务？')) {
    await ts.deleteTask(ts.selectedTaskId)
  }
}

// 创建任务
async function handleCreate() {
  if (!newTaskTitle.value.trim()) return
  await ts.createTask({
    title: newTaskTitle.value.trim(),
    description: newTaskDesc.value.trim() || undefined,
    priority: newTaskPriority.value,
    dueDate: newTaskDueDate.value || undefined,
  })
  newTaskTitle.value = ''
  newTaskDesc.value = ''
  ts.showCreateDialog = false
  ts.fetchTasks()
}

// 子任务进度百分比
function subProgress(task: { subtasks: { isCompleted: boolean }[] }): number {
  if (!task.subtasks.length) return 0
  const done = task.subtasks.filter(s => s.isCompleted).length
  return Math.round((done / task.subtasks.length) * 100)
}

// 格式化日期
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// 页面加载
onMounted(() => ts.fetchTasks())
</script>

<style scoped>
.tasks-page {
  padding: 36px 40px; height: 100%; overflow-y: auto; display: flex; flex-direction: column;
}

/* ===== 顶部栏 ===== */
.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
}
.title { font-size: 24px; font-weight: 700; }
.toolbar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.filter-select { padding: 8px 14px; }

/* ===== 主布局 ===== */
.layout { display: flex; gap: 20px; flex: 1; min-height: 0; }

/* ===== 左侧列表 ===== */
.task-list { flex: 1; min-width: 0; overflow-y: auto; }
.cards { display: flex; flex-direction: column; gap: 8px; }

/* 任务卡片 */
.task-card {
  padding: 14px 18px; cursor: pointer; transition: all 0.2s;
  display: flex; flex-direction: column; gap: 8px;
}
.task-card:hover { border-color: rgba(0,229,216,0.3); }
.task-card.selected { border-color: rgba(0,229,216,0.5); background: rgba(0,229,216,0.04); }

.task-header { display: flex; align-items: center; gap: 10px; }
.task-checkbox { width: 16px; height: 16px; accent-color: #00E5D8; cursor: pointer; }
.task-title { font-size: 15px; font-weight: 500; color: #F1F5F9; flex: 1; }
.task-title.done { text-decoration: line-through; color: #64748B; }

.task-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; padding-left: 26px; }

/* 优先级标签 */
.pri-badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.pri-badge.high { background: rgba(239,68,68,0.15); color: #EF4444; }
.pri-badge.medium { background: rgba(251,191,36,0.15); color: #FBBF24; }
.pri-badge.low { background: rgba(148,163,184,0.15); color: #94A3B8; }

/* 子任务进度条 */
.sub-progress { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; margin-left: 26px; }
.sub-progress-bar { height: 100%; background: #00E5D8; border-radius: 2px; transition: width 0.3s; }

/* ===== 右侧详情 ===== */
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
.edit-desc {
  min-height: 80px; resize: vertical; font-size: 13px; padding: 10px;
}
.detail-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.btn-decompose {
  padding: 8px 14px; background: rgba(0,229,216,0.1);
  border: 1px solid rgba(0,229,216,0.2); border-radius: 10px;
  color: #00E5D8; cursor: pointer; font-size: 13px;
}
.btn-decompose:hover:not(:disabled) { background: rgba(0,229,216,0.2); }
.btn-decompose:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-delete {
  width: 36px; height: 36px; background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2); border-radius: 10px;
  color: #EF4444; cursor: pointer; font-size: 14px;
}

/* 子任务 */
.subtask-section { margin-top: 8px; }
.subtask-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; font-size: 13px;
}
.subtask-row input[type="checkbox"] { accent-color: #00E5D8; }
.subtask-row .done { text-decoration: line-through; color: #64748B; flex: 1; }
.btn-del-sub {
  width: 22px; height: 22px; line-height: 22px; text-align: center;
  background: transparent; border: none; color: #64748B;
  cursor: pointer; border-radius: 4px; font-size: 11px;
}
.btn-del-sub:hover { background: rgba(239,68,68,0.15); color: #EF4444; }

.add-subtask input {
  width: 100%; padding: 8px 12px; font-size: 13px;
}

/* 弹窗 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px); display: flex;
  align-items: center; justify-content: center; z-index: 1000;
}
.modal-card { width: 480px; padding: 28px; display: flex; flex-direction: column; gap: 14px; }
.modal-card h3 { font-size: 18px; font-weight: 600; }
.modal-actions { display: flex; gap: 10px; }
.modal-btns { display: flex; gap: 12px; justify-content: flex-end; }
.btn-cancel {
  background: transparent; border: 1px solid rgba(148,163,184,0.3);
  color: #94A3B8; border-radius: 10px; padding: 10px 20px; cursor: pointer;
}
.btn-cancel:hover { border-color: #F1F5F9; color: #F1F5F9; }

.hint { text-align: center; padding: 60px 20px; }
</style>
