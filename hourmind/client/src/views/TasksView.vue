<!-- client/src/views/TasksView.vue -->
<!-- 待办事项页面 —— 筛选、任务卡片、子任务管理、创建编辑弹窗 -->
<template>
  <div class="tasks-page" style="padding: 40px; max-width: 960px; margin: 0 auto;">
    <!-- 页面头部 -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
      <h2 style="font-size: 28px;">待办事项</h2>
      <button class="btn-primary" @click="openCreateDialog">添加任务</button>
    </div>

    <!-- 筛选标签 -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <button v-for="tab in filterTabs" :key="tab.value"
              @click="activeFilter = tab.value"
              :style="{
                padding: '8px 20px', fontSize: '14px', borderRadius: '20px', border: '1px solid',
                borderColor: activeFilter === tab.value ? 'var(--accent)' : 'var(--border-glow)',
                background: activeFilter === tab.value ? 'rgba(0,229,216,0.1)' : 'transparent',
                color: activeFilter === tab.value ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }">
        {{ tab.label }}
      </button>
    </div>

    <!-- 加载状态 -->
    <p v-if="taskStore.loading" style="color: var(--text-secondary); text-align: center; padding: 40px;">加载中...</p>

    <!-- 空状态 -->
    <div v-if="!taskStore.loading && filteredTasks.length === 0" class="glass-card" style="padding: 48px; text-align: center; color: var(--text-secondary);">
      暂无任务，点击上方按钮添加
    </div>

    <!-- 任务卡片列表 -->
    <div v-for="task in filteredTasks" :key="task.id"
         class="glass-card task-card"
         :class="{
           'task-card--overdue': isOverdue(task),
           'task-card--in-progress': task.status === 'in_progress' && !isOverdue(task),
           'task-card--done': task.status === 'done',
         }"
         style="padding: 20px; margin-bottom: 12px;">
      <!-- 任务主体行 -->
      <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;" @click="toggleExpand(task.id)">
        <!-- 左侧：标题 + 标签 -->
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <!-- 状态勾选框 -->
            <span @click.stop="toggleStatus(task)"
                  :style="{
                    width: '20px', height: '20px', borderRadius: '6px', border: '2px solid',
                    borderColor: task.status === 'done' ? 'var(--success)' : 'var(--text-secondary)',
                    background: task.status === 'done' ? 'var(--success)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', color: '#fff',
                  }">
              {{ task.status === 'done' ? '&#10003;' : '' }}
            </span>
            <!-- 任务标题 -->
            <span :style="{ textDecoration: task.status === 'done' ? 'line-through' : 'none', color: task.status === 'done' ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: 600 }">
              {{ task.title }}
            </span>
          </div>
          <!-- 子标签行 -->
          <div style="margin-top: 8px; margin-left: 30px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <!-- 优先级徽章 -->
            <span :style="{
              padding: '2px 10px', borderRadius: '10px', fontSize: '12px',
              background: priorityBg(task.priority), color: priorityColor(task.priority),
            }">
              {{ priorityLabel(task.priority) }}
            </span>
            <!-- 状态徽章 -->
            <span :style="{
              padding: '2px 10px', borderRadius: '10px', fontSize: '12px',
              background: statusBg(task.status), color: statusColor(task.status),
            }">
              {{ statusLabel(task.status) }}
            </span>
            <!-- 截止日期 -->
            <span v-if="task.due_date" style="color: var(--text-secondary); font-size: 12px;">
              {{ formatDueDate(task.due_date) }}
            </span>
            <!-- 子任务进度 -->
            <span v-if="task.subtasks && task.subtasks.length > 0" style="color: var(--text-secondary); font-size: 12px;">
              {{ subtaskProgress(task) }}
            </span>
          </div>
        </div>

        <!-- 右侧：操作按钮 -->
        <div style="display: flex; gap: 8px;" @click.stop>
          <!-- 状态切换按钮 -->
          <button v-if="task.status !== 'done'"
                  :style="nextStatusBtnStyle(task.status)"
                  @click="advanceStatus(task)">
            {{ nextStatusLabel(task.status) }}
          </button>
          <!-- 编辑按钮 -->
          <button style="background: transparent; border: 1px solid var(--border-glow); color: var(--text-secondary); border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer;" @click="openEditDialog(task)">
            编辑
          </button>
          <!-- 删除按钮 -->
          <button class="btn-danger" style="padding: 6px 12px; font-size: 13px;" @click="handleDelete(task.id)">
            删除
          </button>
        </div>
      </div>

      <!-- 展开子任务区域 -->
      <div v-if="expandedId === task.id" style="margin-top: 16px; margin-left: 30px; padding-top: 16px; border-top: 1px solid var(--border-glow);">
        <!-- 子任务列表 -->
        <div v-for="sub in task.subtasks" :key="sub.id" style="display: flex; align-items: center; gap: 10px; padding: 8px 0;">
          <!-- 子任务勾选框 -->
          <span @click="toggleSubTask(task.id, sub)"
                :style="{
                  width: '16px', height: '16px', borderRadius: '4px', border: '2px solid',
                  borderColor: sub.done ? 'var(--success)' : 'var(--text-secondary)',
                  background: sub.done ? 'var(--success)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', color: '#fff', flexShrink: '0',
                }">
            {{ sub.done ? '&#10003;' : '' }}
          </span>
          <!-- 子任务标题 -->
          <span :style="{ flex: '1', textDecoration: sub.done ? 'line-through' : 'none', color: sub.done ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '14px' }">
            {{ sub.title }}
          </span>
          <!-- 删除子任务 -->
          <button @click="handleDeleteSub(task.id, sub.id)"
                  style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px;">
            &times;
          </button>
        </div>
        <!-- 添加子任务输入框 -->
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <input v-model="newSubTaskTitles[task.id]" class="auth-input" placeholder="添加子任务..."
                 style="margin-bottom: 0; padding: 8px 12px; font-size: 13px;"
                 @keyup.enter="handleAddSub(task.id)" />
          <button class="btn-primary" style="padding: 8px 16px; font-size: 13px;" @click="handleAddSub(task.id)">
            添加
          </button>
        </div>
      </div>
    </div>

    <!-- 创建/编辑任务弹窗 -->
    <div v-if="showDialog" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;">
      <div class="glass-card" style="width: 500px; padding: 32px;">
        <h3 style="margin-bottom: 20px;">{{ editingTask ? '编辑任务' : '添加任务' }}</h3>

        <!-- 粘贴解析区 -->
        <textarea v-model="parseText" class="auth-input"
                  placeholder="粘贴文本，自动识别标题、优先级、日期..."
                  style="min-height: 80px; resize: vertical; font-family: inherit;" />
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <button class="btn-primary" style="padding: 8px 16px; font-size: 13px;"
                  :disabled="parseLoading || !parseText.trim()"
                  @click="handleParse">
            {{ parseLoading ? '解析中...' : '智能解析 ✨' }}
          </button>
          <span v-if="parseError" class="error-text">{{ parseError }}</span>
        </div>

        <!-- 任务标题 -->
        <input v-model="form.title" class="auth-input" placeholder="任务标题" />
        <!-- 任务描述 -->
        <textarea v-model="form.description" class="auth-input" placeholder="描述（可选）"
                  style="min-height: 80px; resize: vertical; font-family: inherit;" />
        <!-- 优先级选择 -->
        <select v-model="form.priority" class="auth-input">
          <option value="low">低优先级</option>
          <option value="medium">中优先级</option>
          <option value="high">高优先级</option>
        </select>
        <!-- 截止日期 -->
        <input v-model="form.due_date" type="datetime-local" class="auth-input" style="font-size: 16px; padding: 14px 16px; min-height: 48px;" />

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
// TasksView 逻辑 —— 任务筛选展示、展开子任务、创建编辑弹窗、状态流转
import { ref, reactive, computed, onMounted } from 'vue'
import { useTaskStore, type Task } from '@/stores/taskStore'

const taskStore = useTaskStore()

// 到期提醒

// 筛选相关
const filterTabs = [
  { label: '全部', value: 'all' },           // 显示全部任务
  { label: '待办', value: 'todo' },          // 只显示待办任务
  { label: '进行中', value: 'in_progress' },  // 只显示进行中任务
  { label: '已完成', value: 'done' },          // 只显示已完成任务
]
const activeFilter = ref('all')  // 当前激活的筛选条件

// 展开状态 —— 记录当前展开的任务 ID
const expandedId = ref<string | null>(null)

// 新建子任务标题输入缓存 —— key 为任务 ID
const newSubTaskTitles = reactive<Record<string, string>>({})

// 弹窗相关
const showDialog = ref(false)          // 是否显示弹窗
const editingTask = ref<Task | null>(null)  // 正在编辑的任务（null 表示新建）
const formLoading = ref(false)         // 表单提交加载状态
const formError = ref('')              // 表单错误提示
const form = reactive({
  title: '',        // 任务标题
  description: '',  // 任务描述
  priority: 'medium',  // 优先级，默认中等
  due_date: '',     // 截止日期
})

// 粘贴解析状态
const parseText = ref('')          // 粘贴的原始文本
const parseLoading = ref(false)   // 解析加载中
const parseError = ref('')        // 解析错误提示

// 组件挂载时加载任务列表
onMounted(async () => {
  await taskStore.fetchTasks()
})

/** 根据筛选条件过滤任务列表 */
const filteredTasks = computed(() => {
  if (activeFilter.value === 'all') return taskStore.tasks   // 显示全部
  return taskStore.tasks.filter(t => t.status === activeFilter.value)  // 按状态筛选
})

/** 切换任务展开/折叠 */
function toggleExpand(taskId: string) {
  expandedId.value = expandedId.value === taskId ? null : taskId
}

/** 切换任务完成状态 */

/** 判断任务是否已逾期 —— 截止日期已过且未完成 */

/** 检查即将到期的任务并弹通知 —— 提前 2 分钟提醒 */
function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status !== 'todo') return false  // 只有待办状态才判断逾期
  const now = new Date()  // 当前时间
  const due = new Date(task.due_date)  // 截止时间
  return due < now  // 截止时间已过
}
async function toggleStatus(task: Task) {
  const newStatus = task.status === 'done' ? 'todo' : 'done'
  await taskStore.updateTask(task.id, { status: newStatus })
}

/** 推进任务状态到下一步 */
function advanceStatus(task: Task) {
  // 状态流转：todo → in_progress → done
  const nextMap: Record<string, string> = {
    todo: 'in_progress',
    in_progress: 'done',
  }
  const next = nextMap[task.status]
  if (next) taskStore.updateTask(task.id, { status: next })
}

/** 获取推进按钮的文本 */
function nextStatusLabel(status: string): string {
  if (status === 'todo') return '标记进行中'          // 待办 → 开始进行
  if (status === 'in_progress') return '标记完成'   // 进行中 → 标记完成
  return ''
}

/** 获取推进按钮的样式 */
function nextStatusBtnStyle(status: string): Record<string, string> {
  if (status === 'todo') return {
    border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent',
    borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
  }
  if (status === 'in_progress') return {
    border: 'none', color: 'var(--bg-primary)', background: 'var(--success)',
    borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
  }
  return {}
}

/** 切换子任务完成状态 */
async function toggleSubTask(taskId: string, sub: any) {
  await taskStore.updateSubTask(taskId, sub.id, { done: !sub.done })
}

/** 添加子任务 */
async function handleAddSub(taskId: string) {
  const title = newSubTaskTitles[taskId]?.trim()  // 去首尾空白
  if (!title) return
  await taskStore.addSubTask(taskId, title)
  newSubTaskTitles[taskId] = ''  // 清空输入框
}

/** 删除任务 */
async function handleDelete(taskId: string) {
  if (!confirm('确定删除此任务？')) return  // 确认删除
  await taskStore.deleteTask(taskId)
}

/** 删除子任务 */
async function handleDeleteSub(taskId: string, subtaskId: string) {
  await taskStore.deleteSubTask(taskId, subtaskId)
}

/** 打开新建任务弹窗 */
function openCreateDialog() {
  editingTask.value = null        // 标记为新建模式
  form.title = ''                 // 清空标题
  form.description = ''           // 清空描述
  form.priority = 'medium'        // 默认中优先级
  form.due_date = ''              // 清空日期
  formError.value = ''            // 清空错误
  showDialog.value = true         // 显示弹窗
}

/** 打开编辑任务弹窗 */
function openEditDialog(task: Task) {
  editingTask.value = task        // 设置编辑目标
  form.title = task.title         // 回填标题
  form.description = task.description || ''  // 回填描述
  form.priority = task.priority || 'medium'  // 回填优先级
  form.due_date = task.due_date || ''        // 回填日期
  formError.value = ''            // 清空错误
  showDialog.value = true         // 显示弹窗
}

/** 关闭弹窗 */

/** 智能解析 —— 调用 AI 解析粘贴文本，自动填充表单 */
async function handleParse() {
  parseError.value = ""  // 清空错误
  if (!parseText.value.trim()) return  // 空文本不处理

  parseLoading.value = true  // 开始加载
  try {
    const token = localStorage.getItem("hourmind_token") || ""  // 获取 JWT
    const res = await fetch("/api/tasks/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ text: parseText.value }),
    })
    const data = await res.json()  // 解析响应

    if (data.detail) {
      parseError.value = data.detail  // 显示后端错误
    } else {
      // 成功 —— 自动填充表单字段
      form.title = data.title || ""  // 填充标题
      form.priority = data.priority || "medium"  // 填充优先级
      if (data.due_date) form.due_date = data.due_date.slice(0, 16)  // 填充日期（取 YYYY-MM-DD）
      form.description = parseText.value  // 原文作为描述
      parseText.value = ""  // 清空粘贴区
    }
  } catch {
    parseError.value = "网络错误，请检查后端是否启动"
  } finally {
    parseLoading.value = false  // 结束加载
  }
}
function closeDialog() {
  showDialog.value = false        // 隐藏弹窗
  editingTask.value = null        // 清空编辑目标
  formError.value = ''            // 清空错误
}

/** 提交表单（新建或编辑） */
async function handleSubmit() {
  formError.value = ''            // 清空旧错误
  if (!form.title.trim()) {       // 标题必填
    formError.value = '请输入任务标题'
    return
  }
  formLoading.value = true        // 开始加载
  try {
    const payload = {
      title: form.title.trim(),           // 标题
      description: form.description.trim(),  // 描述
      priority: form.priority,             // 优先级
      due_date: form.due_date || undefined,  // 截止日期
    }
    if (editingTask.value) {
      // 编辑模式：更新已有任务
      await taskStore.updateTask(editingTask.value.id, payload)
    } else {
      // 新建模式：创建新任务
      await taskStore.createTask(payload.title, payload.description, payload.priority, payload.due_date)
    }
    closeDialog()  // 关闭弹窗
  } catch {
    formError.value = '提交失败，请重试'
  } finally {
    formLoading.value = false  // 结束加载
  }
}

// ===== 样式辅助函数 =====

/** 优先级背景色 */
function priorityBg(p: string): string {
  if (p === 'high') return 'rgba(239,68,68,0.15)'     // 高优先级红色
  if (p === 'medium') return 'rgba(251,146,60,0.15)'  // 中优先级橙色
  return 'rgba(148,163,184,0.15)'                      // 低优先级灰色
}

/** 优先级文字色 */
function priorityColor(p: string): string {
  if (p === 'high') return '#EF4444'
  if (p === 'medium') return '#FB923C'
  return '#94A3B8'
}

/** 优先级文本 */
function priorityLabel(p: string): string {
  if (p === 'high') return '高'
  if (p === 'medium') return '中'
  return '低'
}

/** 状态背景色 */
function statusBg(s: string): string {
  if (s === 'done') return 'rgba(52,211,153,0.15)'
  if (s === 'in_progress') return 'rgba(96,165,250,0.15)'
  return 'rgba(148,163,184,0.15)'
}

/** 状态文字色 */
function statusColor(s: string): string {
  if (s === 'done') return '#34D399'
  if (s === 'in_progress') return '#60A5FA'
  return '#94A3B8'
}

/** 状态文本 */
function statusLabel(s: string): string {
  if (s === 'done') return '已完成'
  if (s === 'in_progress') return '进行中'
  return '待办'
}

/** 格式化截止日期 */
function formatDueDate(d: string): string {
  if (!d) return ''
  const date = new Date(d)  // 解析日期
  // 判断是否已过期
  const today = new Date()
  today.setHours(0, 0, 0, 0)  // 当天零点
  const due = new Date(d)
  due.setHours(0, 0, 0, 0)    // 截止日零点
  const diff = due.getTime() - today.getTime()  // 差值（毫秒）
  const days = Math.ceil(diff / 86400000)       // 转换为天数
  if (days < 0) return '已过期 ' + Math.abs(days) + ' 天'
  if (days === 0) return '今天截止'
  if (days <= 7) return '剩余 ' + days + ' 天'
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

/** 子任务进度文本 */
function subtaskProgress(task: Task): string {
  if (!task.subtasks || task.subtasks.length === 0) return ''
  const done = task.subtasks.filter(s => s.done).length  // 已完成的子任务数
  return `${done}/${task.subtasks.length} 子任务`
}
</script>

<style scoped>
/* ── 任务卡片颜色变体 ── */

/* 逾期 —— 京东红流光边框 */
.task-card--overdue::before {
  background: conic-gradient(
    from var(--angle, 0deg),
    #E2231A, #C41230, #FF4D4F, #E2231A, #B01020
  ) !important; /* 京东红系锥形渐变 */
}

.task-card--overdue:hover {
  box-shadow: 0 8px 36px rgba(226, 35, 26, 0.25), 0 0 0 1px rgba(226, 35, 26, 0.1) inset !important; /* 红色辉光 */
}

/* 进行中 —— 淘宝橙流光边框 */
.task-card--in-progress::before {
  background: conic-gradient(
    from var(--angle, 0deg),
    #FF6A00, #FF9000, #FFB347, #FF6A00, #E85D00
  ) !important; /* 淘宝橙系锥形渐变 */
}

.task-card--in-progress:hover {
  box-shadow: 0 8px 36px rgba(255, 106, 0, 0.25), 0 0 0 1px rgba(255, 106, 0, 0.1) inset !important; /* 橙色辉光 */
}

/* 已完成 —— 淡绿色微光，静态 */
.task-card--done {
  opacity: 0.6; /* 半透明淡化 */
}
.task-card--done::before {
  animation: none !important; /* 停止旋转 */
  background: conic-gradient(
    from 0deg,
    rgba(52, 211, 153, 0.15), rgba(52, 211, 153, 0.05)
  ) !important; /* 微弱绿边 */
}


</style>
