<!-- client/src/views/DashboardView.vue -->
<!-- 仪表盘首页 —— 欢迎区、统计卡片（数字滚动）、最近对话、快捷操作 —— 量子流光动效 -->
<template>
  <div class="dashboard-page">
    <!-- 背景噪点纹理层 —— CSS 伪元素实现 -->
    <div class="noise-overlay"></div>

    <!-- 欢迎区域 —— 页面加载动画序列第 1 项 -->
    <div class="welcome-section reveal-item reveal-1">
      <h1 class="welcome-title">
        HourMind 小时智脑
      </h1>
      <p class="welcome-subtitle">
        私人第二大脑 + 多模型 AI 助理
      </p>
    </div>

    <!-- 加载状态 -->
    <p v-if="loading" class="loading-text reveal-item reveal-1">加载中...</p>

    <!-- 统计卡片行 —— 动画序列第 2~4 项（依次出现） -->
    <div v-if="!loading" class="stats-row">
      <!-- 今日 Token 用量 -->
      <div class="stat-card glass-card reveal-item reveal-2" style="--accent-glow: var(--accent);">
        <p class="stat-label">今日 Token 用量</p>
        <p class="stat-value" style="color: var(--accent);">
          <span v-if="animated.todayTokens !== null">{{ formatTokens(animated.todayTokens) }}</span>
          <span v-else>--</span>
        </p>
      </div>
      <!-- 活跃 Key 数量 -->
      <div class="stat-card glass-card reveal-item reveal-3" style="--accent-glow: var(--accent-purple);">
        <p class="stat-label">活跃 Keys</p>
        <p class="stat-value" style="color: var(--accent-purple);">
          <span v-if="animated.activeKeys !== null">{{ animated.activeKeys }}</span>
          <span v-else>--</span>
        </p>
      </div>
      <!-- 对话总数 -->
      <div class="stat-card glass-card reveal-item reveal-4" style="--accent-glow: #60A5FA;">
        <p class="stat-label">对话总数</p>
        <p class="stat-value" style="color: #60A5FA;">
          <span v-if="animated.totalConversations !== null">{{ animated.totalConversations }}</span>
          <span v-else>--</span>
        </p>
      </div>
    </div>

    <!-- 最近对话列表 —— 动画序列第 5 项 -->
    <div v-if="!loading" class="conversations-section reveal-item reveal-5">
      <h3 class="section-title">最近对话</h3>
      <!-- 无对话空状态 -->
      <div v-if="recentConversations.length === 0" class="empty-conversations glass-card">
        <span class="empty-icon">&#9670;</span>
        <p class="empty-text">暂无对话记录</p>
        <p class="empty-hint">点击下方「开始新对话」开启你的 AI 之旅</p>
      </div>
      <!-- 对话列表 -->
      <TransitionGroup name="conv-list" tag="div">
        <div v-for="(conv, idx) in recentConversations" :key="conv.id"
             class="conv-card glass-card"
             :style="{ animationDelay: (0.08 * idx) + 's' }"
             @click="$router.push('/chat')">
          <div class="conv-row">
            <div class="conv-info">
              <p class="conv-title">{{ conv.title || '未命名对话' }}</p>
              <p class="conv-meta">
                {{ conv.model || 'default' }} · {{ conv.message_count || 0 }} 条消息
              </p>
            </div>
            <span class="conv-date">
              {{ formatDate(conv.updated_at || conv.created_at) }}
            </span>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- 快捷操作按钮 —— 动画序列第 6 项 -->
    <div v-if="!loading" class="quick-actions-section reveal-item reveal-6">
      <h3 class="section-title">快捷操作</h3>
      <div class="quick-actions-row">
        <button class="action-btn action-btn--primary" @click="$router.push('/chat')">
          <span class="action-btn__glow"></span>
          <span class="action-btn__text">开始新对话</span>
        </button>
        <button class="action-btn action-btn--accent" style="--action-accent: var(--accent);" @click="$router.push('/keys')">
          <span class="action-btn__glow"></span>
          <span class="action-btn__text">管理 Keys</span>
        </button>
        <button class="action-btn action-btn--accent" style="--action-accent: var(--accent-purple);" @click="$router.push('/tasks')">
          <span class="action-btn__glow"></span>
          <span class="action-btn__text">待办事项</span>
        </button>
        <button class="action-btn action-btn--accent" style="--action-accent: #60A5FA;" @click="$router.push('/knowledge')">
          <span class="action-btn__glow"></span>
          <span class="action-btn__text">知识库</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// DashboardView 逻辑 —— 加载仪表盘数据，驱动统计数字滚动动画
import { ref, reactive, onMounted, watch } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/appStore'

const appStore = useAppStore()

// 加载状态
const loading = ref(true)

// 统计数据（后台原始值）
const stats = reactive({
  today_tokens: 0,        // 今日 Token 用量
  active_keys: 0,          // 活跃 Key 数量
  total_conversations: 0,  // 对话总数
})

// 动画显示值 —— 从 0 逐步滚动到目标数字
const animated = reactive({
  todayTokens: null as number | null,      // Token 动画值（null 表示未开始）
  activeKeys: null as number | null,        // Key 动画值
  totalConversations: null as number | null, // 对话总数动画值
})

// 最近对话列表（最多 5 条）
const recentConversations = ref<any[]>([])

// 组件挂载时加载仪表盘数据
onMounted(async () => {
  await loadDashboard()
})

/** 加载仪表盘数据 —— 调用后端 GET /api/dashboard */
async function loadDashboard() {
  loading.value = true
  try {
    const data = await api('GET', '/dashboard', undefined, appStore.token)
    if (data) {
      // 填充统计数据
      stats.today_tokens = data.today_tokens || 0
      stats.active_keys = data.active_keys || 0
      stats.total_conversations = data.total_conversations || 0
      // 加载最近对话（最多 5 条）
      if (data.recent_conversations && Array.isArray(data.recent_conversations)) {
        recentConversations.value = data.recent_conversations.slice(0, 5)
      }
    }
  } catch {
    // 仪表盘接口暂不可用，显示默认值
    console.warn('仪表盘数据加载失败')
  } finally {
    loading.value = false
  }
}

// 监听 loading 状态 —— 当数据加载完成且统计非零时，触发数字滚动动画
watch(loading, (newVal, oldVal) => {
  // 从加载中变为加载完成，且存在统计数据
  if (oldVal === true && newVal === false) {
    startCountAnimations()
  }
})

/** 触发三项统计数字的滚动动画 */
function startCountAnimations() {
  // 同时启动三项数字的计数动画
  animateCount('todayTokens', stats.today_tokens, 800)
  animateCount('activeKeys', stats.active_keys, 600)
  animateCount('totalConversations', stats.total_conversations, 700)
}

/**
 * 数字滚动动画 —— 使用 requestAnimationFrame 从 0 平滑过渡到目标值
 * @param key animated 对象中的字段名
 * @param target 目标数值
 * @param duration 动画持续时间（毫秒）
 */
function animateCount(key: keyof typeof animated, target: number, duration: number) {
  // 如果目标值为 0，直接设置为 0
  if (target === 0) {
    animated[key] = 0
    return
  }

  const startTime = performance.now()  // 动画起始时间戳

  // 动画帧循环
  function step(now: number) {
    const elapsed = now - startTime            // 已过时间
    const progress = Math.min(elapsed / duration, 1)  // 进度 0~1
    // 使用 ease-out 缓动曲线让数字滚动先快后慢
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = Math.round(target * eased) // 当前应显示的数字（取整）
    animated[key] = current

    // 未完成则继续下一帧
    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  // 启动第一帧
  requestAnimationFrame(step)
}

/** 格式化 Token 数量为可读文本 */
function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

/** 格式化日期为简洁形式 */
function formatDate(d: string): string {
  if (!d) return ''
  const date = new Date(d)           // 解析 ISO 日期字符串
  const now = new Date()              // 当前时间
  const diffMs = now.getTime() - date.getTime()  // 时间差（毫秒）
  const diffMins = Math.floor(diffMs / 60000)    // 转换为分钟
  if (diffMins < 1) return '刚刚'     // 不到 1 分钟
  if (diffMins < 60) return diffMins + ' 分钟前' // 不到 1 小时
  if (diffMins < 1440) return Math.floor(diffMins / 60) + ' 小时前'  // 不到 1 天
  // 超过 1 天显示日期
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
/* ============================================================
   DashboardView 量子流光动效样式
   —— 交错渐显 · 数字滚动 · 辉光悬停 · 噪点纹理 · 快捷操作着色
   ============================================================ */

/* ── 页面容器 ── */
.dashboard-page {
  position: relative;
  padding: 40px;
  max-width: 1100px;
  margin: 0 auto;
  /* 隐藏溢出以防噪点层超出 */
  overflow: hidden;
}

/* ── 背景噪点纹理（CSS-only，伪元素） ── */
.noise-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;  /* 不拦截鼠标事件 */
  z-index: 0;
  opacity: 0.03;         /* 极低透明度，微弱噪点感 */
  /* 使用 SVG 滤镜生成噪点纹理 */
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}

/* ============================================================
   交错渐显动画序列
   ============================================================ */

/* 渐显关键帧 —— 从下方 20px 淡入 */
@keyframes reveal-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 所有需要动画揭示的元素初始隐藏 */
.reveal-item {
  opacity: 0;
  animation: reveal-up 0.6s ease-out forwards;
}

/* 各元素交错延迟 —— 逐项依次出现 */
.reveal-1 { animation-delay: 0.05s; }   /* 欢迎区域 */
.reveal-2 { animation-delay: 0.2s; }    /* 统计卡片 1 */
.reveal-3 { animation-delay: 0.3s; }    /* 统计卡片 2 */
.reveal-4 { animation-delay: 0.4s; }    /* 统计卡片 3 */
.reveal-5 { animation-delay: 0.55s; }   /* 最近对话 */
.reveal-6 { animation-delay: 0.7s; }    /* 快捷操作 */

/* ============================================================
   欢迎区域
   ============================================================ */

.welcome-section {
  margin-bottom: 40px;
}

/* 标题 —— 渐变色 + 文字辉光阴影 */
.welcome-title {
  font-size: 36px;
  background: linear-gradient(135deg, var(--accent), var(--accent-blue), var(--accent-purple));
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shift 4s ease infinite;  /* 复用全局渐变位移动画 */
  /* 文字发光阴影 —— 模拟辉光扩散 */
  filter: drop-shadow(0 0 18px rgba(0, 229, 216, 0.3));
  margin: 0;
}

/* 副标题 —— 更轻量、更大间距 */
.welcome-subtitle {
  color: var(--text-secondary);
  font-size: 16px;
  margin-top: 12px;
  opacity: 0.75;          /* 比正文更淡 */
  letter-spacing: 0.5px;  /* 微字间距 */
  margin-bottom: 0;
}

/* 加载文字 */
.loading-text {
  color: var(--text-secondary);
  text-align: center;
  padding: 40px;
}

/* ============================================================
   统计卡片行
   ============================================================ */

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 40px;
}

/* 统计卡片 —— 继承 glass-card，增强悬停辉光 */
.stat-card {
  padding: 24px;
  /* 默认过渡 */
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.35s ease;
  cursor: default;        /* 非可点击卡片 */
}

/* 悬停：抬升 + 对应颜色辉光扩散 */
.stat-card:hover {
  transform: translateY(-6px) scale(1.03);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.5),
    0 0 30px var(--accent-glow, var(--accent)),
    0 0 60px color-mix(in srgb, var(--accent-glow, var(--accent)) 30%, transparent);
}

/* 统计标签 */
.stat-label {
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 8px;
  text-transform: uppercase;     /* 小号大写更具设计感 */
  letter-spacing: 1px;
  margin-top: 0;
}

/* 统计数值 */
.stat-value {
  font-size: 32px;
  font-weight: 700;
  margin: 0;
  /* 数字字体用等宽Tabular数字，避免跳动 */
  font-variant-numeric: tabular-nums;
}

/* ============================================================
   最近对话区域
   ============================================================ */

.conversations-section {
  margin-bottom: 40px;
}

/* 区块标题 */
.section-title {
  font-size: 20px;
  margin-bottom: 16px;
  margin-top: 0;
  color: var(--text-primary);
  font-weight: 600;
}

/* ── 空状态 ── */
.empty-conversations {
  padding: 40px 32px;
  text-align: center;
  color: var(--text-secondary);
  /* 去掉 glass-card 默认的悬停位移 */
  transition: box-shadow 0.3s ease;
}
.empty-conversations:hover {
  transform: none;
}

/* 空状态装饰图标 —— 微菱形 */
.empty-icon {
  display: block;
  font-size: 32px;
  color: var(--accent);
  opacity: 0.4;
  margin-bottom: 12px;
  animation: pulse-icon 2.5s ease-in-out infinite;
}

/* 图标脉冲动画 */
@keyframes pulse-icon {
  0%, 100% { opacity: 0.25; transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(1.08); }
}

/* 空状态主文字 */
.empty-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
  opacity: 0.8;
}

/* 空状态提示文字 */
.empty-hint {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  opacity: 0.6;
}

/* ── 对话卡片列表 ── */
/* TransitionGroup 进出动画 */
.conv-list-enter-active {
  transition: all 0.4s ease-out;
}
.conv-list-leave-active {
  transition: all 0.25s ease-in;
}
.conv-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.conv-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 单张对话卡片 */
.conv-card {
  padding: 16px 20px;
  margin-bottom: 10px;
  cursor: pointer;
  /* 覆盖默认 glass-card transition，使用自定义缓动 */
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.3s ease,
              border-color 0.3s ease;
  /* 卡片进入动画（Base 样式由 TransitionGroup 接管） */
  animation: reveal-up 0.4s ease-out both;
}

/* 悬停增强 */
.conv-card:hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 8px 32px rgba(0, 229, 216, 0.12), 0 0 0 1px rgba(0, 229, 216, 0.15) inset;
}

/* 对话卡片内容行 */
.conv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 对话信息区 */
.conv-info {
  flex: 1;
  min-width: 0;            /* 允许文字截断 */
}

/* 对话标题 */
.conv-title {
  font-weight: 600;
  font-size: 15px;
  margin: 0;
}

/* 对话元信息 */
.conv-meta {
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 4px;
  margin-bottom: 0;
}

/* 对话日期 */
.conv-date {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;     /* 日期不换行 */
  margin-left: 16px;
}

/* ============================================================
   快捷操作区域
   ============================================================ */

.quick-actions-section {
  /* 无额外容器样式，依赖内部布局 */
}

.quick-actions-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

/* ── 快捷操作按钮（通用） ── */
.action-btn {
  position: relative;
  padding: 14px 28px;
  border-radius: var(--radius);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  /* 背景玻璃效果 */
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  color: var(--text-primary);
  /* 辉光边框 */
  border: 1px solid transparent;
  /* 平滑过渡 */
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.3s ease,
              border-color 0.3s ease;
  overflow: hidden;        /* 内部辉光伪元素裁剪 */
  z-index: 0;
}

/* 按钮背景辉光伪元素 —— 悬停时在按钮背后扩散 */
.action-btn__glow {
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: radial-gradient(
    circle at 50% 50%,
    var(--action-glow, var(--accent)),
    transparent 70%
  );
  opacity: 0;
  z-index: -1;
  transition: opacity 0.35s ease;
}

/* 悬停时显示辉光 */
.action-btn:hover .action-btn__glow {
  opacity: 0.15;
}

/* 按钮文字层级 */
.action-btn__text {
  position: relative;
  z-index: 1;
}

/* 悬停抬升 */
.action-btn:hover {
  transform: translateY(-3px) scale(1.04);
}

/* 按下回缩 */
.action-btn:active {
  transform: scale(0.97);
}

/* ── 主操作按钮：「开始新对话」—— 流光渐变 ── */
.action-btn--primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-blue), var(--accent-indigo), var(--accent));
  background-size: 300% 300%;
  color: #fff;
  animation: gradient-shift 3s ease infinite;  /* 复用全局渐变流动 */
  box-shadow: 0 0 20px rgba(0, 229, 216, 0.25);
  border: none;
}

.action-btn--primary:hover {
  box-shadow: 0 0 36px rgba(0, 229, 216, 0.5), 0 0 60px rgba(99, 102, 241, 0.2);
  transform: translateY(-3px) scale(1.04);
}

/* ── 次要操作按钮：「管理 Keys」「待办事项」「知识库」—— 各色边框 ── */
.action-btn--accent {
  background: transparent;
  border: 1px solid var(--action-accent);
  color: var(--action-accent);
  /* --action-accent 由行内 style 传入 */
  --action-glow: var(--action-accent);
  /* 初始微弱辉光 */
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}

/* 悬停：边框辉光扩散 */
.action-btn--accent:hover {
  border-color: var(--action-accent);
  box-shadow:
    0 0 20px color-mix(in srgb, var(--action-accent) 40%, transparent),
    0 0 40px color-mix(in srgb, var(--action-accent) 15%, transparent),
    0 8px 24px rgba(0, 0, 0, 0.4);
  color: #fff;
  /* 背景微微着色 */
  background: color-mix(in srgb, var(--action-accent) 12%, transparent);
}

/* ============================================================
   响应式适配 —— 小屏幕单列布局
   ============================================================ */

@media (max-width: 768px) {
  .dashboard-page {
    padding: 24px 16px;
  }

  .stats-row {
    grid-template-columns: 1fr;   /* 统计卡片单列堆叠 */
  }

  .welcome-title {
    font-size: 28px;
  }

  .quick-actions-row {
    flex-direction: column;       /* 按钮纵向排列 */
  }

  .action-btn {
    width: 100%;
    text-align: center;
  }
}
</style>
