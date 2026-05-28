// ============================================================
// taskStore.ts —— 个人待办事项状态管理（Pinia Store）
//
// 管理任务的增删改查、子任务管理、AI 智能拆解。
// 任务状态流转：todo → in_progress → done → archived
// ============================================================

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wsClient } from '@/composables/useWs'

// 任务类型
export interface Task {
  id: string; title: string; description: string | null
  priority: string; status: string; dueDate: string | null
  completedAt: string | null; isRecurring: boolean; tags: string
  createdAt: string; updatedAt: string
  subtasks: Subtask[]
}
// 子任务类型
export interface Subtask {
  id: string; taskId: string; title: string
  isCompleted: boolean; order: number
}

export const useTaskStore = defineStore('tasks', () => {
  // ——— 状态 ———
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const statusFilter = ref('all')          // 状态筛选：all/todo/in_progress/done/archived
  const priorityFilter = ref('all')        // 优先级筛选
  const selectedTaskId = ref<string | null>(null)  // 当前选中的任务（用于编辑面板）
  const isDecomposing = ref(false)          // 是否在 AI 拆解中
  const showCreateDialog = ref(false)       // 是否显示新建弹窗

  // ——— 计算属性（内联）———
  function filteredTasks(): Task[] {
    let result = tasks.value
    if (statusFilter.value !== 'all') result = result.filter(t => t.status === statusFilter.value)
    if (priorityFilter.value !== 'all') result = result.filter(t => t.priority === priorityFilter.value)
    return result
  }

  // ——— 操作 ———

  // 拉取任务列表
  async function fetchTasks() {
    loading.value = true
    try {
      tasks.value = await wsClient.send('tasks.list', {
        status: statusFilter.value,
        priority: priorityFilter.value,
      })
    } finally {
      loading.value = false
    }
  }

  // 创建任务
  async function createTask(data: { title: string; description?: string; priority?: string; dueDate?: string }) {
    const task = await wsClient.send<Task>('tasks.create', data)
    tasks.value.unshift(task)
    selectedTaskId.value = task.id
  }

  // 更新任务
  async function updateTask(taskId: string, data: Record<string, any>) {
    const updated = await wsClient.send<Task>('tasks.update', { taskId, ...data })
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx >= 0) tasks.value[idx] = updated
  }

  // 切换完成状态
  async function toggleTask(taskId: string) {
    const result = await wsClient.send('tasks.toggle', { taskId })
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.status = result.status
      task.completedAt = result.status === 'done' ? new Date().toISOString() : null
    }
  }

  // 删除任务
  async function deleteTask(taskId: string) {
    await wsClient.send('tasks.delete', { taskId })
    tasks.value = tasks.value.filter(t => t.id !== taskId)
    if (selectedTaskId.value === taskId) selectedTaskId.value = null
  }

  // 切换任务状态
  async function setTaskStatus(taskId: string, status: string) {
    await wsClient.send('tasks.set_status', { taskId, status })
    const task = tasks.value.find(t => t.id === taskId)
    if (task) task.status = status
  }

  // AI 智能拆解
  async function decomposeTask(taskId: string) {
    isDecomposing.value = true
    try {
      const subtasks = await wsClient.send<Subtask[]>('tasks.decompose', { taskId })
      const task = tasks.value.find(t => t.id === taskId)
      if (task) task.subtasks = subtasks
    } finally {
      isDecomposing.value = false
    }
  }

  // 添加子任务
  async function addSubtask(taskId: string, title: string) {
    const st = await wsClient.send<Subtask>('subtasks.create', { taskId, title })
    const task = tasks.value.find(t => t.id === taskId)
    if (task) task.subtasks.push(st)
    return st
  }

  // 勾选子任务
  async function toggleSubtask(subtaskId: string) {
    const updated = await wsClient.send<Subtask>('subtasks.toggle', { subtaskId })
    for (const task of tasks.value) {
      const st = task.subtasks.find(s => s.id === subtaskId)
      if (st) { st.isCompleted = updated.isCompleted; break }
    }
  }

  // 删除子任务
  async function deleteSubtask(subtaskId: string) {
    await wsClient.send('subtasks.delete', { subtaskId })
    for (const task of tasks.value) {
      task.subtasks = task.subtasks.filter(s => s.id !== subtaskId)
    }
  }

  return {
    tasks, loading, statusFilter, priorityFilter, selectedTaskId,
    isDecomposing, showCreateDialog,
    filteredTasks,
    fetchTasks, createTask, updateTask, toggleTask, deleteTask, setTaskStatus,
    decomposeTask, addSubtask, toggleSubtask, deleteSubtask,
  }
})
