// client/src/stores/taskStore.ts
// 待办事项状态管理 —— 任务 CRUD、子任务管理、筛选
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/appStore'

// 子任务接口
export interface SubTask {
  id: string           // 子任务 ID
  title: string        // 子任务标题
  done: boolean        // 是否完成
  task_id: string      // 所属任务 ID
  created_at: string   // 创建时间
}

// 任务接口
export interface Task {
  id: string           // 任务 ID
  title: string        // 任务标题
  description: string  // 描述
  status: string       // 状态: pending / in_progress / done
  priority: string     // 优先级: low / medium / high
  due_date: string | null  // 截止日期
  subtasks: SubTask[]  // 子任务列表
  created_at: string   // 创建时间
  updated_at: string   // 更新时间
}

export const useTaskStore = defineStore('task', () => {
  // 任务列表
  const tasks = ref<Task[]>([])
  // 加载状态
  const loading = ref(false)

  // 获取认证 token
  function token() { return useAppStore().token }

  /** 获取所有任务 */
  async function fetchTasks() {
    loading.value = true
    try {
      const data = await api('GET', '/tasks', undefined, token())
      if (Array.isArray(data)) tasks.value = data
    } catch {
      console.warn('获取任务列表失败')
    } finally {
      loading.value = false
    }
  }

  /** 创建新任务 */
  async function createTask(title: string, description?: string, priority?: string, due_date?: string) {
    const body: Record<string, any> = { title }
    if (description) body.description = description   // 描述（可选）
    if (priority) body.priority = priority              // 优先级（可选）
    if (due_date) body.due_date = due_date              // 截止日期（可选）
    const data = await api('POST', '/tasks', body, token())
    if (data.id) await fetchTasks()  // 创建成功后刷新列表
    return data
  }

  /** 更新任务 */
  async function updateTask(taskId: string, fields: Record<string, any>) {
    const data = await api('PUT', `/tasks/${taskId}`, fields, token())
    if (data.id) await fetchTasks()  // 更新成功后刷新列表
    return data
  }

  /** 删除任务 */
  async function deleteTask(taskId: string) {
    await api('DELETE', `/tasks/${taskId}`, undefined, token())
    await fetchTasks()  // 删除后刷新列表
  }

  /** 添加子任务 */
  async function addSubTask(taskId: string, title: string) {
    const data = await api('POST', `/tasks/${taskId}/subtasks`, { title }, token())
    if (data.id) await fetchTasks()  // 添加成功后刷新列表
    return data
  }

  /** 更新子任务（切换完成状态） */
  async function updateSubTask(taskId: string, subtaskId: string, fields: Record<string, any>) {
    const data = await api('PUT', `/tasks/${taskId}/subtasks/${subtaskId}`, fields, token())
    if (data.id) await fetchTasks()  // 更新成功后刷新列表
    return data
  }

  /** 删除子任务 */
  async function deleteSubTask(taskId: string, subtaskId: string) {
    await api('DELETE', `/tasks/${taskId}/subtasks/${subtaskId}`, undefined, token())
    await fetchTasks()  // 删除后刷新列表
  }

  return {
    tasks,
    loading,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    addSubTask,
    updateSubTask,
    deleteSubTask,
  }
})
