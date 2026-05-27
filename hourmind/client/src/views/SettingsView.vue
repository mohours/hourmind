<!--
 SettingsView.vue —— 系统设置页面
 Quantum Glass 风格，卡片分组布局
 设置项：默认模型 / 温度 / 粒子背景 / 辉光强度
-->
<template>
  <div class="settings-page">
    <h2 class="page-title">系统设置</h2>

    <!-- 加载中 -->
    <div v-if="ss.loading" class="hint text-muted">加载中...</div>

    <!-- 设置表单 -->
    <div v-else class="cards">
      <!-- AI 模型设置卡片 -->
      <div class="glass-card card">
        <h3 class="card-title">AI 模型设置</h3>

        <!-- 默认模型 -->
        <div class="field">
          <label class="label">默认模型</label>
          <select v-model="ss.settings.default_model" class="input">
            <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
            <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="grok-2">Grok 2</option>
          </select>
          <span class="hint-text">新建对话时默认使用的 AI 模型</span>
        </div>

        <!-- 温度参数 -->
        <div class="field">
          <label class="label">温度参数：{{ ss.settings.temperature }}</label>
          <input
            v-model.number="ss.settings.temperature"
            type="range"
            min="0"
            max="1"
            step="0.1"
            class="slider"
          />
          <div class="slider-labels">
            <span>0 精确</span>
            <span>1 创意</span>
          </div>
        </div>
      </div>

      <!-- 外观设置卡片 -->
      <div class="glass-card card">
        <h3 class="card-title">外观设置</h3>

        <!-- 粒子背景 -->
        <div class="field row">
          <div>
            <label class="label">粒子背景</label>
            <span class="hint-text">开启星空粒子背景效果</span>
          </div>
          <button
            class="toggle"
            :class="{ active: ss.settings.particle_bg === 'true' }"
            @click="ss.settings.particle_bg = ss.settings.particle_bg === 'true' ? 'false' : 'true'"
          >
            <span class="toggle-dot"></span>
          </button>
        </div>

        <!-- 辉光强度 -->
        <div class="field">
          <label class="label">辉光强度</label>
          <div class="radio-group">
            <label
              v-for="opt in ['low', 'medium', 'high']"
              :key="opt"
              class="radio-item"
              :class="{ active: ss.settings.glow_intensity === opt }"
            >
              <input
                v-model="ss.settings.glow_intensity"
                type="radio"
                :value="opt"
                class="radio-hidden"
              />
              {{ opt === 'low' ? '低' : opt === 'medium' ? '中' : '高' }}
            </label>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <button class="btn-primary save-btn" :disabled="ss.saving" @click="ss.saveSettings()">
          {{ ss.saving ? '保存中...' : ss.saved ? '已保存' : '保存设置' }}
        </button>
        <button class="btn-reset" @click="ss.resetDefaults()">恢复默认</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue' // 页面生命周期
import { useSettingsStore } from '@/stores/settingsStore' // 设置状态

const ss = useSettingsStore() // 设置 store 实例

// 页面加载时拉取设置
onMounted(() => ss.fetchSettings())
</script>

<style scoped>
/* 页面容器 */
.settings-page {
  padding: 36px 40px; /* 内部间距 */
  height: 100%; /* 填满父容器 */
  overflow-y: auto; /* 内容溢出时滚动 */
  max-width: 640px; /* 限制宽度，居中美观 */
}

.page-title {
  font-size: 24px; /* 大标题 */
  font-weight: 700; /* 粗体 */
  margin-bottom: 28px; /* 底部间距 */
}

/* 卡片列表 */
.cards {
  display: flex; /* Flex 列 */
  flex-direction: column; /* 纵向 */
  gap: 20px; /* 卡片间距 */
}

/* 设置卡片 */
.card {
  padding: 24px; /* 内部间距 */
  display: flex; /* Flex 列 */
  flex-direction: column; /* 纵向 */
  gap: 20px; /* 字段间距 */
}

.card-title {
  font-size: 16px; /* 中号字体 */
  font-weight: 600; /* 半粗体 */
  color: #F1F5F9; /* 浅色 */
  padding-bottom: 12px; /* 底部间距 */
  border-bottom: 1px solid rgba(0, 229, 216, 0.1); /* 量子青分割线 */
}

/* 字段 */
.field {
  display: flex; /* Flex 列 */
  flex-direction: column; /* 纵向 */
  gap: 8px; /* 间距 */
}
.field.row {
  flex-direction: row; /* 横向 */
  justify-content: space-between; /* 两端对齐 */
  align-items: center; /* 垂直居中 */
}

.label {
  font-size: 14px; /* 小号字体 */
  font-weight: 500; /* 中等粗细 */
  color: #E2E8F0; /* 浅色 */
}

.hint-text {
  font-size: 12px; /* 极小字体 */
  color: #64748B; /* 石板灰 */
}

/* 输入框 */
.input {
  padding: 10px 14px; /* 内部间距 */
  font-size: 14px; /* 小号字体 */
}

/* 滑块 */
.slider {
  -webkit-appearance: none; /* 去掉默认样式 */
  appearance: none;
  width: 100%; /* 占满宽度 */
  height: 6px; /* 轨道高度 */
  background: rgba(0, 229, 216, 0.15); /* 轨道颜色 */
  border-radius: 3px; /* 圆角 */
  outline: none; /* 去轮廓 */
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px; /* 滑块大小 */
  height: 20px; /* 滑块大小 */
  background: #00E5D8; /* 量子青 */
  border-radius: 50%; /* 圆形 */
  cursor: pointer; /* 手型光标 */
  box-shadow: 0 0 12px rgba(0, 229, 216, 0.4); /* 辉光 */
}

.slider-labels {
  display: flex; /* Flex */
  justify-content: space-between; /* 两端对齐 */
  font-size: 12px; /* 极小字体 */
  color: #64748B; /* 石板灰 */
}

/* 开关按钮 */
.toggle {
  width: 48px; /* 固定宽 */
  height: 26px; /* 固定高 */
  border-radius: 13px; /* 胶囊形 */
  background: rgba(255, 255, 255, 0.1); /* 关闭背景 */
  border: 1px solid rgba(255, 255, 255, 0.15); /* 边框 */
  cursor: pointer; /* 手型光标 */
  position: relative; /* 相对定位（为滑块定位） */
  transition: all 0.2s; /* 过渡 */
  flex-shrink: 0; /* 不缩小 */
}
.toggle.active {
  background: rgba(0, 229, 216, 0.3); /* 开启背景 */
  border-color: rgba(0, 229, 216, 0.4); /* 开启边框 */
}
.toggle-dot {
  position: absolute; /* 绝对定位 */
  top: 3px; /* 距顶部 */
  left: 3px; /* 距左侧 */
  width: 18px; /* 固定宽 */
  height: 18px; /* 固定高 */
  background: #F1F5F9; /* 白色 */
  border-radius: 50%; /* 圆形 */
  transition: all 0.2s; /* 过渡 */
}
.toggle.active .toggle-dot {
  left: 25px; /* 开启时滑到右侧 */
  background: #00E5D8; /* 量子青 */
}

/* 单选组 */
.radio-group {
  display: flex; /* Flex 行 */
  gap: 10px; /* 间距 */
}
.radio-item {
  flex: 1; /* 等分 */
  text-align: center; /* 居中 */
  padding: 10px; /* 内部间距 */
  font-size: 14px; /* 小号字体 */
  color: #94A3B8; /* 石板灰 */
  background: rgba(255, 255, 255, 0.04); /* 极淡背景 */
  border: 1px solid rgba(255, 255, 255, 0.08); /* 极淡边框 */
  border-radius: 10px; /* 圆角 */
  cursor: pointer; /* 手型光标 */
  transition: all 0.2s; /* 过渡 */
}
.radio-item.active {
  color: #00E5D8; /* 量子青 */
  background: rgba(0, 229, 216, 0.1); /* 量子青半透明 */
  border-color: rgba(0, 229, 216, 0.3); /* 量子青边框 */
}
.radio-hidden {
  display: none; /* 隐藏原生 radio */
}

/* 操作按钮区 */
.actions {
  display: flex; /* Flex */
  gap: 12px; /* 间距 */
}

.save-btn {
  padding: 12px 32px; /* 内部间距 */
  font-size: 15px; /* 小号字体 */
}

.btn-reset {
  padding: 12px 24px; /* 内部间距 */
  background: transparent; /* 透明背景 */
  border: 1px solid rgba(255, 255, 255, 0.1); /* 极淡边框 */
  border-radius: 12px; /* 圆角 */
  color: #94A3B8; /* 石板灰 */
  cursor: pointer; /* 手型光标 */
  font-size: 14px; /* 小号字体 */
  transition: all 0.2s; /* 过渡 */
}
.btn-reset:hover {
  color: #F1F5F9; /* 悬停浅色 */
  border-color: rgba(255, 255, 255, 0.2); /* 悬停边框 */
}

/* 提示 */
.hint {
  text-align: center; /* 居中 */
  padding: 60px 20px; /* 上下间距 */
}
</style>
