<!-- client/src/views/KeysView.vue -->
<!-- API Key 管理页面 —— 玻璃卡片列表 + 添加弹窗 -->
<template>
  <div class="keys-page" style="padding: 40px; max-width: 960px; margin: 0 auto;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px;">
      <h2 style="font-size: 28px;">API Key 管理</h2>
      <button class="btn-primary" @click="showAddDialog = true">添加 Key</button>
    </div>

    <!-- 加载中 -->
    <p v-if="keyStore.loading" style="color: var(--text-secondary); text-align: center;">加载中...</p>

    <!-- Key 列表 -->
    <div v-if="keyStore.keys.length === 0 && !keyStore.loading" style="text-align: center; padding: 60px; color: var(--text-secondary);">
      还没有添加任何 API Key，点击上方按钮开始
    </div>

    <div v-for="key in keyStore.keys" :key="key.id" class="glass-card" style="padding: 24px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <!-- 厂商名 + 别名 -->
        <div>
          <span style="font-weight: 600; font-size: 18px;">{{ key.provider_name }}</span>
          <span v-if="key.alias" style="color: var(--text-secondary); margin-left: 12px;">{{ key.alias }}</span>
          <!-- 状态标签 -->
          <span :style="statusStyle(key.status)" style="margin-left: 12px; font-size: 12px; padding: 2px 8px; border-radius: 8px;">
            {{ statusText(key.status) }}
          </span>
        </div>
        <!-- Key 后 6 位 -->
        <span style="color: var(--text-secondary); font-family: monospace;">****{{ key.key_suffix }}</span>
      </div>

      <!-- 操作按钮 -->
      <div style="margin-top: 16px; display: flex; gap: 12px;">
        <button class="btn-primary" style="padding: 6px 16px; font-size: 13px;" @click="handleTest(key.id)">
          测试连接
        </button>
        <button
          :style="{ padding: '6px 16px', fontSize: '13px', background: 'transparent', color: key.status === 'active' ? '#FB923C' : '#34D399', border: '1px solid ' + (key.status === 'active' ? '#FB923C' : '#34D399'), borderRadius: '12px', cursor: 'pointer' }"
          @click="keyStore.toggleKey(key.id)"
        >
          {{ key.status === 'active' ? '禁用' : '启用' }}
        </button>
        <button class="btn-danger" style="padding: 6px 16px; font-size: 13px;" @click="keyStore.deleteKey(key.id)">
          删除
        </button>
      </div>

      <!-- 测试结果 -->
      <div v-if="testResults[key.id]" style="margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 13px;"
           :style="{ background: testResults[key.id].ok ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', color: testResults[key.id].ok ? '#34D399' : '#EF4444' }">
        {{ testResults[key.id].ok ? '连接成功' : '连接失败' }}
        <span v-if="testResults[key.id].latency_ms"> · {{ testResults[key.id].latency_ms }}ms</span>
        <span v-if="testResults[key.id].error"> · {{ testResults[key.id].error }}</span>
      </div>
    </div>

    <!-- 添加 Key 弹窗 -->
    <div v-if="showAddDialog" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;">
      <div class="glass-card" style="width: 480px; padding: 32px;">
        <h3 style="margin-bottom: 20px;">添加 API Key</h3>

        <!-- 厂商选择 -->
        <select v-model="form.providerId" class="auth-input">
          <option value="">选择厂商</option>
          <option v-for="p in keyStore.providers" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>

        <!-- Key 输入 -->
        <input v-model="form.keyValue" type="password" placeholder="输入 API Key" class="auth-input" />
        <input v-model="form.alias" placeholder="别名（可选）" class="auth-input" />

        <p v-if="formError" class="error-text">{{ formError }}</p>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px;">
          <button class="btn-danger" style="padding: 10px 20px;" @click="showAddDialog = false; formError = ''">取消</button>
          <button class="btn-primary" style="padding: 10px 20px;" :disabled="formLoading" @click="handleCreate">
            {{ formLoading ? '添加中...' : '确认添加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// KeysView 逻辑 —— 加载列表、添加、删除、测试 Key
import { ref, onMounted, reactive } from 'vue'
import { useKeyStore } from '@/stores/keyStore'

const keyStore = useKeyStore()
const showAddDialog = ref(false)
const formError = ref('')
const formLoading = ref(false)
const testResults = reactive<Record<string, any>>({})

const form = reactive({ providerId: '', keyValue: '', alias: '' })

onMounted(async () => {
  await Promise.all([keyStore.fetchProviders(), keyStore.fetchKeys()])
})

async function handleCreate() {
  formError.value = ''
  if (!form.providerId) { formError.value = '请选择厂商'; return }
  if (!form.keyValue) { formError.value = '请输入 Key'; return }

  formLoading.value = true
  try {
    const res = await keyStore.createKey(form.providerId, form.keyValue, form.alias)
    if (res.id) {
      showAddDialog.value = false
      form.providerId = ''; form.keyValue = ''; form.alias = ''
    } else if (res.detail) {
      formError.value = res.detail
    }
  } catch {
    formError.value = '网络错误'
  } finally {
    formLoading.value = false
  }
}

async function handleTest(keyId: string) {
  const res = await keyStore.testKey(keyId)
  testResults[keyId] = res
}

function statusStyle(s: string) {
  if (s === 'active') return { background: 'rgba(52,211,153,0.15)', color: '#34D399' }
  if (s === 'disabled') return { background: 'rgba(251,146,60,0.15)', color: '#FB923C' }
  return { background: 'rgba(239,68,68,0.15)', color: '#EF4444' }
}

function statusText(s: string) {
  if (s === 'active') return '已启用'
  if (s === 'disabled') return '已禁用'
  return '已删除'
}
</script>
