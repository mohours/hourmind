// client/src/stores/keyStore.ts
// API Key 管理状态 —— CRUD + 测试 + 厂商列表
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/appStore'

export interface Provider {
  id: string
  name: string
  slug: string
  base_url: string
  logo_url: string | null
}

export interface ApiKey {
  id: string
  provider_name: string
  alias: string
  key_suffix: string
  status: string
  tags: string
  usage: string
  test_result: string
  created_at: string
  updated_at: string
}

export const useKeyStore = defineStore('key', () => {
  const keys = ref<ApiKey[]>([])
  const providers = ref<Provider[]>([])
  const loading = ref(false)

  function token() { return useAppStore().token }

  /** 加载厂商列表 */
  async function fetchProviders() {
    const data = await api('GET', '/providers', undefined, token())
    if (Array.isArray(data)) providers.value = data
    return data
  }

  /** 加载 Key 列表 */
  async function fetchKeys() {
    loading.value = true
    const data = await api('GET', '/keys', undefined, token())
    if (Array.isArray(data)) keys.value = data
    loading.value = false
    return data
  }

  /** 创建 Key */
  async function createKey(providerId: string, keyValue: string, alias: string) {
    const data = await api('POST', '/keys', { provider_id: providerId, key_value: keyValue, alias }, token())
    if (data.id) await fetchKeys()
    return data
  }

  /** 删除 Key */
  async function deleteKey(keyId: string) {
    await api('DELETE', `/keys/${keyId}`, undefined, token())
    await fetchKeys()
  }

  /** 切换启用/禁用 */
  async function toggleKey(keyId: string) {
    const data = await api('PUT', `/keys/${keyId}/toggle`, undefined, token())
    if (data.ok) await fetchKeys()
    return data
  }

  /** 连通性测试 */
  async function testKey(keyId: string) {
    const data = await api('POST', `/keys/${keyId}/test`, undefined, token())
    if (data.ok !== undefined) await fetchKeys()
    return data
  }

  return { keys, providers, loading, fetchProviders, fetchKeys, createKey, deleteKey, toggleKey, testKey }
})
