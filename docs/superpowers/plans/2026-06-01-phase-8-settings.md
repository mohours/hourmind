# HourMind 阶段 8 — 系统设置 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现系统设置页面，包含 AI 模型设置、外观个性化、数据与隐私管理、关于系统四个模块。

**Architecture:** Python FastAPI 后端 (port 8000) + Vue 3 + Vite 前端 (port 5173)，后端用 sqlite3 原生驱动，配置数据存储在 `config` 表（key-value 结构）。JWT 认证已在阶段 2 实现，所有接口使用 `require_auth` 依赖。

**Tech Stack:** Python 3.12, FastAPI, uvicorn, sqlite3 / Vue 3, TypeScript, Vite 5, Pinia, Vue Router

---

### Task 1: 设置后端 API

**Files:**
- Create: `server/routes/settings.py`
- Modify: `server/main.py`

- [ ] **Step 1: 创建 settings.py**

```python
# server/routes/settings.py
# 设置 API —— 读取/更新 config 表中的配置项
from fastapi import APIRouter, Depends, Body
from database import get_db
from routes.auth import require_auth

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings(
    user_id: str = Depends(require_auth),
):
    """读取所有配置项，返回 key-value 字典"""
    db = get_db()

    rows = db.execute("SELECT key, value FROM config").fetchall()

    settings = {}
    for row in rows:
        settings[row["key"]] = row["value"]

    db.close()
    return {"settings": settings}


@router.put("/settings")
def update_settings(
    body: dict = Body(...),
    user_id: str = Depends(require_auth),
):
    """批量更新配置项 —— 使用 UPSERT 语义"""
    db = get_db()

    if not isinstance(body, dict) or not body:
        db.close()
        return {"success": False, "error": "无效的请求体"}

    for key, value in body.items():
        # SQLite 的 INSERT OR REPLACE 相当于 UPSERT
        db.execute(
            """INSERT OR REPLACE INTO config (key, value)
               VALUES (?, ?)""",
            (key, str(value) if not isinstance(value, str) else value)
        )

    db.commit()
    db.close()

    return {"success": True}
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
from routes.settings import router as settings_router
app.include_router(settings_router)
```

- [ ] **Step 3: 验证后端 API**

```bash
cd server
source venv/bin/activate
python main.py &
```

```bash
# 写入设置
curl -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"default_model":"gpt-4","temperature":"0.7","font_size":"medium"}' \
  http://localhost:8000/api/settings

# 读取设置
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/settings
```

预期返回 `{"settings": {"default_model": "gpt-4", "temperature": "0.7", "font_size": "medium"}}`

- [ ] **Step 4: 提交**

```bash
git add server/routes/settings.py server/main.py
git commit -m "feat: 设置后端 API —— 配置项读写（UPSERT 语义）"
```

---

### Task 2: 设置前端 Store

**Files:**
- Create: `client/src/stores/settingsStore.ts`

- [ ] **Step 1: 创建 settingsStore.ts**

```typescript
// client/src/stores/settingsStore.ts
// 设置状态管理 —— 配置对象、读取、保存、自动保存提示
import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

// 设置项默认值
const DEFAULT_SETTINGS: Record<string, string> = {
  default_model: 'gpt-4',
  temperature: '0.7',
  max_tokens: '4096',
  context_length: '32768',
  web_search_default: 'false',
  particle_bg: 'false',
  glow_intensity: 'medium',
  font_size: 'medium',
  animation_speed: 'normal',
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

export const useSettingsStore = defineStore('settings', () => {
  // --- 状态 ---
  // 设置对象 —— 所有配置项的 key-value 映射
  const settings = reactive<Record<string, string>>({ ...DEFAULT_SETTINGS })
  const loading = ref(false)       // 加载状态
  const saving = ref(false)        // 保存状态
  const saved = ref(false)         // 是否已保存提示（3 秒后自动消失）

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  // --- 操作 ---

  /** fetchSettings —— 从后端读取所有设置项，未设置的用默认值 */
  async function fetchSettings(): Promise<void> {
    loading.value = true
    try {
      const data = await apiFetch('/api/settings')
      // 合并后端配置和默认值（后端有的用后端值，没有的用默认值）
      if (data.settings) {
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          settings[key] = data.settings[key] ?? DEFAULT_SETTINGS[key]
        }
      }
    } catch {
      // 后端不可用时使用默认值
      console.warn('获取设置失败，使用默认配置')
    } finally {
      loading.value = false
    }
  }

  /** saveSettings —— 保存指定配置项到后端（增量更新） */
  async function saveSettings(updates: Record<string, string>): Promise<void> {
    saving.value = true
    try {
      const data = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      if (data.success) {
        // 同步到本地状态
        for (const key of Object.keys(updates)) {
          settings[key] = updates[key]
        }
        showSavedIndicator()
      }
    } catch {
      console.warn('保存设置失败')
    } finally {
      saving.value = false
    }
  }

  /** showSavedIndicator —— 显示"已保存"提示，3 秒后自动消失 */
  function showSavedIndicator(): void {
    saved.value = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { saved.value = false }, 3000)
  }

  // --- 便捷 getter 函数 ---

  /** get —— 获取单个设置值，返回 string */
  function get(key: string): string {
    return settings[key] ?? DEFAULT_SETTINGS[key] ?? ''
  }

  /** getNumber —— 获取数字类型设置值 */
  function getNumber(key: string): number {
    return parseFloat(settings[key] || '0')
  }

  /** getBool —— 获取布尔类型设置值 */
  function getBool(key: string): boolean {
    return settings[key] === 'true'
  }

  return {
    settings, loading, saving, saved,
    fetchSettings, saveSettings,
    get, getNumber, getBool,
  }
})
```

- [ ] **Step 2: 提交**

```bash
git add client/src/stores/settingsStore.ts
git commit -m "feat: 设置前端 Store —— 配置读写 + 默认值补齐 + 保存提示"
```

---

### Task 3: 设置视图

**Files:**
- Create: `client/src/views/SettingsView.vue`
- Modify: `client/src/router.ts`

- [ ] **Step 1: 创建 SettingsView.vue**

```vue
<!-- client/src/views/SettingsView.vue -->
<!-- 系统设置页面 —— AI 模型、外观、数据隐私、关于 -->
<template>
  <div class="settings-page">
    <h1 class="page-title">系统设置</h1>

    <!-- 自动保存提示 -->
    <div class="save-indicator" :class="{ visible: store.saved }">
      <span class="save-icon">&#10003;</span> 已保存
    </div>

    <!-- 1. AI 模型设置 -->
    <section class="glass-card settings-section">
      <h2 class="section-title">AI 模型设置</h2>

      <div class="form-row">
        <div class="form-group">
          <label>默认模型</label>
          <select
            :value="store.settings.default_model"
            @change="onSave('default_model', ($event.target as HTMLSelectElement).value)"
            class="glass-select"
          >
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="deepseek-chat">DeepSeek Chat</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="grok-2">Grok 2</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Temperature <span class="setting-value">{{ store.settings.temperature }}</span></label>
          <input
            type="range"
            min="0" max="2" step="0.1"
            :value="store.settings.temperature"
            @input="onSliderInput('temperature', ($event.target as HTMLInputElement).value)"
            @change="onSliderChange('temperature', ($event.target as HTMLInputElement).value)"
            class="slider"
          />
          <div class="slider-labels">
            <span>0 (精确)</span><span>2 (创意)</span>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>最大 Token 数</label>
          <input
            :value="store.settings.max_tokens"
            @change="onSave('max_tokens', ($event.target as HTMLInputElement).value)"
            type="number"
            class="glass-input"
            min="256" max="128000" step="256"
          />
        </div>
        <div class="form-group">
          <label>上下文长度</label>
          <select
            :value="store.settings.context_length"
            @change="onSave('context_length', ($event.target as HTMLSelectElement).value)"
            class="glass-select"
          >
            <option value="4096">4K</option>
            <option value="8192">8K</option>
            <option value="16384">16K</option>
            <option value="32768">32K</option>
            <option value="65536">64K</option>
            <option value="131072">128K</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group toggle-group">
          <label>默认开启联网搜索</label>
          <button
            class="toggle-switch"
            :class="{ active: store.settings.web_search_default === 'true' }"
            @click="onToggle('web_search_default')"
          >
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </div>
    </section>

    <!-- 2. 外观设置 -->
    <section class="glass-card settings-section">
      <h2 class="section-title">外观设置</h2>

      <div class="form-row">
        <div class="form-group toggle-group">
          <label>粒子背景</label>
          <button
            class="toggle-switch"
            :class="{ active: store.settings.particle_bg === 'true' }"
            @click="onToggle('particle_bg')"
          >
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>辉光强度</label>
        <div class="button-group">
          <button
            v-for="level in ['low', 'medium', 'high']"
            :key="level"
            :class="{ active: store.settings.glow_intensity === level }"
            @click="onSave('glow_intensity', level)"
          >{{ glowLabel(level) }}</button>
        </div>
      </div>

      <div class="form-group">
        <label>字体大小</label>
        <div class="button-group">
          <button
            v-for="size in ['small', 'medium', 'large']"
            :key="size"
            :class="{ active: store.settings.font_size === size }"
            @click="onSave('font_size', size)"
          >{{ fontSizeLabel(size) }}</button>
        </div>
      </div>

      <div class="form-group">
        <label>动画速度</label>
        <div class="button-group">
          <button
            v-for="speed in ['fast', 'normal', 'slow']"
            :key="speed"
            :class="{ active: store.settings.animation_speed === speed }"
            @click="onSave('animation_speed', speed)"
          >{{ speedLabel(speed) }}</button>
        </div>
      </div>
    </section>

    <!-- 3. 数据与隐私 -->
    <section class="glass-card settings-section">
      <h2 class="section-title">数据与隐私</h2>

      <div class="danger-zone">
        <div class="danger-row">
          <div class="danger-info">
            <h3>导出所有数据</h3>
            <p>将所有对话、任务、知识库数据导出为 JSON 文件</p>
          </div>
          <button class="btn-primary" @click="onExportAll">导出数据</button>
        </div>

        <div class="danger-row">
          <div class="danger-info">
            <h3>清空所有对话</h3>
            <p>删除所有对话记录，此操作可恢复（软删除）</p>
          </div>
          <button class="btn-danger" @click="onClearConversations">清空对话</button>
        </div>

        <div class="danger-row">
          <div class="danger-info">
            <h3>清空所有 API Key</h3>
            <p>删除所有已保存的厂商 API Key，此操作不可恢复</p>
          </div>
          <button class="btn-danger" @click="onClearKeys">清空 Key</button>
        </div>

        <div class="danger-row danger-last">
          <div class="danger-info">
            <h3>重置系统</h3>
            <p class="danger-text">删除所有数据（对话、任务、知识库、Key、设置），恢复出厂状态</p>
          </div>
          <button class="btn-danger" @click="onResetSystem">重置系统</button>
        </div>
      </div>
    </section>

    <!-- 重置确认弹窗 -->
    <div class="dialog-overlay" v-if="showResetDialog" @click.self="showResetDialog = false">
      <div class="glass-card confirm-dialog">
        <h3>确认重置系统</h3>
        <p>此操作将删除所有数据，不可恢复。请在下方输入 <strong>确认删除</strong> 以继续：</p>
        <input
          v-model="resetConfirmText"
          type="text"
          class="glass-input"
          placeholder="确认删除"
          ref="resetInput"
        />
        <div class="dialog-actions">
          <button class="btn-cancel" @click="showResetDialog = false">取消</button>
          <button
            class="btn-danger"
            :disabled="resetConfirmText !== '确认删除'"
            @click="onConfirmReset"
          >确认重置</button>
        </div>
      </div>
    </div>

    <!-- 4. 关于系统 -->
    <section class="glass-card settings-section">
      <h2 class="section-title">关于系统</h2>

      <div class="about-info">
        <div class="about-row">
          <span class="about-label">版本</span>
          <span class="about-value">v1.0.0</span>
        </div>
        <div class="about-row">
          <span class="about-label">后端</span>
          <span class="about-value">Python FastAPI + SQLite</span>
        </div>
        <div class="about-row">
          <span class="about-label">前端</span>
          <span class="about-value">Vue 3 + TypeScript + Vite</span>
        </div>
        <div class="about-row">
          <span class="about-label">UI 主题</span>
          <span class="about-value">Quantum Glass（量子玻璃）</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// 设置视图组件 —— 四组设置卡片
import { ref, onMounted, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'

const store = useSettingsStore()

// 重置系统相关
const showResetDialog = ref(false)
const resetConfirmText = ref('')
const resetInput = ref<HTMLInputElement | null>(null)

/** onSave —— 保存单个配置项 */
function onSave(key: string, value: string): void {
  store.saveSettings({ [key]: value })
}

/** onToggle —— 切换布尔型配置项 */
function onToggle(key: string): void {
  const newValue = store.settings[key] === 'true' ? 'false' : 'true'
  store.saveSettings({ [key]: newValue })
}

/** onSliderInput —— 滑块拖动时实时更新本地值（不保存） */
function onSliderInput(key: string, value: string): void {
  store.settings[key] = value
}

/** onSliderChange —— 滑块松开后保存 */
function onSliderChange(key: string, value: string): void {
  store.saveSettings({ [key]: value })
}

// 标签映射
function glowLabel(v: string): string {
  const map: Record<string, string> = { low: '柔和', medium: '标准', high: '强烈' }
  return map[v] || v
}
function fontSizeLabel(v: string): string {
  const map: Record<string, string> = { small: '小', medium: '中', large: '大' }
  return map[v] || v
}
function speedLabel(v: string): string {
  const map: Record<string, string> = { fast: '快', normal: '标准', slow: '慢' }
  return map[v] || v
}

/** onExportAll —— 导出所有数据（占位功能，后续实现后端端点） */
function onExportAll(): void {
  alert('数据导出功能将在后续版本实现。')
}

/** onClearConversations —— 清空所有对话 */
async function onClearConversations(): Promise<void> {
  if (!confirm('确认清空所有对话记录？此操作可恢复（软删除）。')) return
  // 调用历史批处理 API 进行软删除
  try {
    const token = localStorage.getItem('token') || ''
    // 先获取所有对话 ID
    const res1 = await fetch('/api/history?page=1&per_page=1000', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res1.json()
    const ids = data.conversations.map((c: any) => c.id)
    if (ids.length === 0) {
      alert('没有对话记录需要清空。')
      return
    }
    await fetch('/api/history/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids, action: 'delete' }),
    })
    alert(`已清空 ${ids.length} 条对话记录。`)
  } catch {
    alert('清空对话失败。')
  }
}

/** onClearKeys —— 清空所有 API Key */
async function onClearKeys(): Promise<void> {
  if (!confirm('确认清空所有 API Key？此操作不可恢复，需要重新添加 Key 才能使用 AI 功能。')) return
  try {
    const token = localStorage.getItem('token') || ''
    // 先获取所有 Key
    const res1 = await fetch('/api/keys', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res1.json()
    const keys = data.keys || []
    if (keys.length === 0) {
      alert('没有 API Key 需要清空。')
      return
    }
    // 逐个删除
    for (const k of keys) {
      await fetch(`/api/keys/${k.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    alert(`已清空 ${keys.length} 个 API Key。`)
  } catch {
    alert('清空 API Key 失败。')
  }
}

/** onResetSystem —— 打开重置确认弹窗 */
async function onResetSystem(): Promise<void> {
  showResetDialog.value = true
  await nextTick()
  resetInput.value?.focus()
}

/** onConfirmReset —— 确认重置系统 */
async function onConfirmReset(): Promise<void> {
  if (resetConfirmText.value !== '确认删除') return
  try {
    const token = localStorage.getItem('token') || ''
    // 清空所有数据表
    const tables = ['subtask', 'task', 'conversation', 'api_key', 'knowledge', 'config']
    for (const table of tables) {
      await fetch(`/api/admin/clear/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
    }
    showResetDialog.value = false
    resetConfirmText.value = ''
    alert('系统已重置，将重新加载页面。')
    window.location.reload()
  } catch {
    alert('重置系统失败，请检查后端服务是否运行。')
  }
}

onMounted(() => { store.fetchSettings() })
</script>

<style scoped>
.settings-page { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
.page-title { font-size: 24px; font-weight: 700; margin-bottom: 28px; }

/* 自动保存提示 */
.save-indicator {
  position: fixed; top: 20px; right: 20px;
  background: rgba(52, 211, 153, 0.15); color: var(--success);
  padding: 10px 20px; border-radius: 10px; font-size: 14px;
  border: 1px solid rgba(52, 211, 153, 0.3);
  opacity: 0; transform: translateY(-10px);
  transition: opacity 0.3s, transform 0.3s;
  pointer-events: none; z-index: 200;
}
.save-indicator.visible { opacity: 1; transform: translateY(0); }
.save-icon { font-weight: 700; }

/* 设置分区 */
.settings-section { padding: 24px; margin-bottom: 20px; }
.section-title { font-size: 18px; margin-bottom: 20px; color: var(--accent); }

/* 表单控件 */
.form-row { display: flex; gap: 20px; margin-bottom: 20px; }
.form-group { flex: 1; margin-bottom: 20px; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.setting-value { margin-left: 8px; color: var(--accent); font-weight: 600; font-size: 13px; }

.glass-input, .glass-select {
  width: 100%; padding: 10px 14px;
  background: rgba(10,12,18,0.6); color: var(--text-primary);
  border: 1px solid var(--border-glow); border-radius: 10px;
  font-size: 14px; outline: none;
}
.glass-select { cursor: pointer; }
.glass-input[type="number"] {
  -moz-appearance: textfield;
}

/* 滑块 */
.slider {
  width: 100%; height: 6px; margin-top: 8px;
  -webkit-appearance: none; appearance: none;
  background: rgba(0, 229, 216, 0.2); border-radius: 3px; outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--accent); cursor: pointer;
}
.slider-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); margin-top: 4px; }

/* 开关 */
.toggle-group { display: flex; justify-content: space-between; align-items: center; }
.toggle-switch {
  width: 48px; height: 26px; border-radius: 13px;
  background: rgba(148, 163, 184, 0.25); border: none;
  cursor: pointer; position: relative; transition: background 0.3s;
}
.toggle-switch.active { background: var(--accent); }
.toggle-thumb {
  width: 22px; height: 22px; border-radius: 50%;
  background: white; position: absolute; top: 2px; left: 2px;
  transition: transform 0.3s;
}
.toggle-switch.active .toggle-thumb { transform: translateX(22px); }

/* 按钮组 */
.button-group { display: flex; gap: 6px; }
.button-group button {
  flex: 1; padding: 9px 0; font-size: 13px;
  background: rgba(148, 163, 184, 0.08); color: var(--text-secondary);
  border: 1px solid transparent; border-radius: 8px; cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.button-group button.active {
  background: rgba(0, 229, 216, 0.1); color: var(--accent);
  border-color: rgba(0, 229, 216, 0.3);
}
.button-group button:hover:not(.active) { color: var(--text-primary); }

/* 危险操作区域 */
.danger-zone { margin-top: 8px; }
.danger-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.danger-row:last-child { border-bottom: none; }
.danger-last { border-top: 1px solid rgba(239, 68, 68, 0.2); padding-top: 20px; margin-top: 4px; }
.danger-info h3 { font-size: 15px; margin-bottom: 4px; }
.danger-info p { font-size: 12px; color: var(--text-secondary); }
.danger-text { color: #EF4444 !important; }

/* 确认弹窗 */
.dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; backdrop-filter: blur(4px);
}
.confirm-dialog { width: 420px; max-width: 90vw; padding: 28px; }
.confirm-dialog h3 { font-size: 18px; margin-bottom: 12px; }
.confirm-dialog p { font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
.btn-cancel { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; padding: 10px 20px; font-size: 14px; }

/* 关于信息 */
.about-info { display: flex; flex-direction: column; gap: 12px; }
.about-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.about-row:last-child { border-bottom: none; }
.about-label { font-size: 14px; color: var(--text-secondary); }
.about-value { font-size: 14px; color: var(--text-primary); font-weight: 500; }
</style>
```

- [ ] **Step 2: 更新 router.ts**

```typescript
{ path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
```

- [ ] **Step 3: 启动前端验证**

```bash
cd client
npm run dev
```

访问 `http://localhost:5173/#/settings` 应看到设置页面，包含四个分区卡片：AI 模型设置、外观设置、数据与隐私、关于系统。

交互验证点：
- 修改下拉框/开关 → 右上角显示 "已保存" 提示，3 秒后消失
- temperature 滑块拖动实时更新本地值，松开后保存
- 辉光强度/字体大小/动画速度 按钮组切换
- 清空对话 / 清空 Key / 重置系统 均有确认弹窗
- 重置系统需要输入"确认删除"才能点击确认按钮

- [ ] **Step 4: 提交**

```bash
git add client/src/views/SettingsView.vue client/src/router.ts
git commit -m "feat: 系统设置视图 —— AI 模型 + 外观个性化 + 数据隐私 + 关于系统"
```

---

## 阶段 8 完成检查清单

- [ ] `GET /api/settings` 返回所有配置项的 key-value 字典
- [ ] `PUT /api/settings` 批量 UPSERT 配置项，返回 success
- [ ] 前端 Store 自动补齐默认值（后端未配置的 key 使用前端默认值）
- [ ] "已保存"提示在保存成功后显示，3 秒后自动消失
- [ ] AI 模型设置区域：默认模型下拉、Temperature 滑块、最大 Token 输入、上下文长度下拉、联网搜索开关
- [ ] 外观设置区域：粒子背景开关、辉光强度按钮组、字体大小按钮组、动画速度按钮组
- [ ] 数据与隐私区域：导出数据、清空对话（确认弹窗）、清空 Key（确认弹窗）、重置系统（输入"确认删除"确认）
- [ ] 关于系统区域：版本号、技术栈信息
- [ ] 重置系统后页面重新加载
