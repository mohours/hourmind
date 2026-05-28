// ============================================================
// keyStore.ts —— API Key 管理状态（Pinia Store）
//
// 管理 API Key 列表、搜索筛选、统计数据、添加弹窗状态。
// 所有 key 操作（增删改查/测试/启禁用）都通过这个 Store。
//
// 状态（state）：
//   keys          — 所有 Key 列表
//   stats         — 统计（总数/活跃/月消耗）
//   providers     — AI 厂商列表（添加 Key 时选厂商用的下拉选项）
//   search        — 搜索关键词
//   statusFilter  — 状态筛选（all/active/disabled/error）
//   showAddDialog — 是否显示添加 Key 弹窗
//
// 计算属性（getters）：
//   filteredKeys  — 根据 search + statusFilter 过滤后的 Key 列表
// ============================================================

// defineStore：定义 Pinia Store
import { defineStore } from 'pinia'
// ref：响应式变量
// computed：计算属性（依赖其他值自动计算）
import { ref, computed } from 'vue'
// wsClient：WebSocket 客户端，发送 API 请求
import { wsClient } from '@/composables/useWs'

// ApiKey 类型定义
// 前端看到的 Key 对象结构（后端不返回 encryptedKey）
export interface ApiKey {
  id: string        // Key ID
  alias: string     // 别名（如 "我的 OpenAI Key"）
  keySuffix: string // Key 最后 6 位（如 "abc123"）
  status: string    // 状态：active/disabled/error
  createdAt: string // 创建时间
  provider: {       // 关联的厂商信息
    id: string      // 厂商 ID
    name: string    // 厂商名称（如 "OpenAI"）
    slug: string    // 厂商唯一标识（如 "openai"）
  }
}

export const useKeyStore = defineStore('keys', () => {
  // ——— 状态 ———

  const keys = ref<ApiKey[]>([])           // Key 列表
  const loading = ref(false)                // 列表加载状态
  const search = ref('')                    // 搜索关键词
  const statusFilter = ref('all')           // 状态筛选
  const stats = ref({ total: 0, active: 0, monthlyCost: 0 })  // 统计数据
  const showAddDialog = ref(false)          // 添加弹窗显示状态
  const providers = ref<{ id: string; name: string; slug: string }[]>([])  // 厂商列表

  // ——— 计算属性 ———

  // filteredKeys：根据 search 和 statusFilter 在客户端过滤（不重新请求后端）
  const filteredKeys = computed(() => {
    let result = keys.value

    // 状态筛选：不等于 'all' 时过滤
    if (statusFilter.value !== 'all') {
      result = result.filter(k => k.status === statusFilter.value)
    }

    // 搜索：关键词匹配别名或厂商名
    if (search.value) {
      const kw = search.value.toLowerCase() // 转小写做大小写不敏感匹配
      result = result.filter(k =>
        k.alias.toLowerCase().includes(kw) ||        // 别名包含关键词
        k.provider.name.toLowerCase().includes(kw),   // 厂商名包含关键词
      )
    }

    return result
  })

  // ——— 操作 ———

  // fetchKeys()：从后端获取 Key 列表
  async function fetchKeys() {
    loading.value = true
    try {
      keys.value = await wsClient.send('keys.list')
    } finally {
      loading.value = false
    }
  }

  // fetchStats()：获取统计数据（顶部三个统计卡片）
  async function fetchStats() {
    stats.value = await wsClient.send('keys.stats')
  }

  // fetchProviders()：获取厂商列表（添加 Key 弹窗中的下拉选项）
  async function fetchProviders() {
    providers.value = await wsClient.send('providers.list')
  }

  // createKey(data)：添加新 Key
  // data = { providerId, keyValue, alias? }
  async function createKey(d: { providerId: string; keyValue: string; alias?: string }) {
    const r = await wsClient.send('keys.create', d)
    keys.value.unshift(r)   // 插到列表最前面（最新添加的显示在最上面）
    await fetchStats()      // 刷新统计数据
  }

  // testKey(id)：测试 Key 连通性
  // 返回 { success, latencyMs, errorMessage? }
  async function testKey(id: string) {
    const r = await wsClient.send('keys.test', { keyId: id })
    // 更新 Key 状态（成功→active，失败→error）
    const k = keys.value.find(x => x.id === id)
    if (k) k.status = r.success ? 'active' : 'error'
    return r
  }

  // deleteKey(id)：删除 Key（软删除）
  async function deleteKey(id: string) {
    await wsClient.send('keys.delete', { keyId: id })
    // 从列表中移除
    keys.value = keys.value.filter(x => x.id !== id)
    await fetchStats() // 刷新统计数据
  }

  // toggleKey(id, on)：启用/禁用 Key
  async function toggleKey(id: string, on: boolean) {
    await wsClient.send('keys.toggle', { keyId: id, enabled: on })
    // 更新本地状态
    const k = keys.value.find(x => x.id === id)
    if (k) k.status = on ? 'active' : 'disabled'
  }

  return {
    keys, loading, search, statusFilter, stats, showAddDialog, providers,
    filteredKeys,
    fetchKeys, fetchStats, fetchProviders,
    createKey, testKey, deleteKey, toggleKey,
  }
})
