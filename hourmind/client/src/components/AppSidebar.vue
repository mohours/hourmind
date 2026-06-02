<!-- client/src/components/AppSidebar.vue -->
<!-- 侧边导航栏 —— 260px 宽，玻璃态风格，7 个导航入口 -->
<template>
  <nav class="sidebar">
    <!-- 品牌 Logo -->
    <div class="sidebar-brand" @click="$router.push('/')">
      <span class="brand-icon">⚡</span>
      <span class="brand-text">HourMind</span>
    </div>

    <!-- 导航菜单 -->
    <div class="sidebar-menu">
      <router-link to="/" class="nav-item" exact-active-class="nav-active">
        <span class="nav-icon">📊</span>
        <span>仪表盘</span>
      </router-link>
      <router-link to="/chat" class="nav-item" active-class="nav-active">
        <span class="nav-icon">💬</span>
        <span>对话</span>
      </router-link>
      <router-link to="/keys" class="nav-item" active-class="nav-active">
        <span class="nav-icon">🔑</span>
        <span>API Keys</span>
      </router-link>
      <router-link to="/tasks" class="nav-item" active-class="nav-active">
        <span class="nav-icon">✅</span>
        <span>待办</span>
      </router-link>
      <router-link to="/knowledge" class="nav-item" active-class="nav-active">
        <span class="nav-icon">📚</span>
        <span>知识库</span>
      </router-link>
      <router-link to="/history" class="nav-item" active-class="nav-active">
        <span class="nav-icon">📋</span>
        <span>历史</span>
      </router-link>
      <router-link to="/settings" class="nav-item" active-class="nav-active">
        <span class="nav-icon">⚙️</span>
        <span>设置</span>
      </router-link>
    </div>

    <!-- 底部登出 -->
    <div class="sidebar-footer">
      <button class="logout-btn" @click="appStore.logout()">退出登录</button>
    </div>
  </nav>
</template>

<script setup lang="ts">
// AppSidebar 逻辑 —— 导航 + 登出
import { useAppStore } from '@/stores/appStore'
const appStore = useAppStore()
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════ */
/*  AppSidebar —— Quantum Flow 美学                              */
/*  深层玻璃 + Tron 光带 + 扫描悬停 + 脉冲激活 + 危险红光         */
/* ═══════════════════════════════════════════════════════════════ */

/* ── 侧边栏主体：深层半透明玻璃 + 双层径向渐变叠加 ── */
.sidebar {
  width: 260px; /* 固定侧边栏宽度 */
  height: 100vh; /* 全屏高度 */
  /* 多层玻璃背景：径向微光叠加 + 深色半透明底 */
  background:
    radial-gradient(ellipse at 30% 15%, rgba(0, 229, 216, 0.04) 0%, transparent 50%), /* 左上角量子青微光 */
    radial-gradient(ellipse at 70% 85%, rgba(99, 102, 241, 0.05) 0%, transparent 50%), /* 右下角靛蓝微光 */
    rgba(10, 12, 20, 0.88); /* 深空半透明基底 */
  backdrop-filter: blur(28px) saturate(140%); /* 加强毛玻璃模糊 + 色彩饱和度 */
  -webkit-backdrop-filter: blur(28px) saturate(140%); /* Safari 兼容 */
  border-right: 1px solid var(--border-glow); /* 右侧微弱边框 */
  display: flex;
  flex-direction: column; /* 纵向弹性布局：品牌 → 菜单 → 登出 */
  position: fixed; /* 固定定位，不随页面滚动 */
  left: 0;
  top: 0;
  z-index: 50; /* 侧边栏层级 */
  overflow: hidden; /* 裁剪溢出（为 ::after 光带预留） */
}

/* ── 右侧 Tron 光带：动画渐变装饰线，缓慢上下流动 ── */
.sidebar::after {
  content: ''; /* 必须设置内容才能显示伪元素 */
  position: absolute;
  right: 0; /* 紧贴右侧边缘 */
  top: 0;
  bottom: 0;
  width: 2px; /* 细光线 */
  /* 多色渐变：量子青 → 蓝 → 紫 → 靛蓝 → 量子青，两端淡出 */
  background: linear-gradient(
    180deg,
    transparent 0%, /* 顶部完全透明 */
    var(--accent) 10%, /* 量子青 */
    var(--accent-blue) 30%, /* 蓝色 */
    var(--accent-purple) 50%, /* 紫色 */
    var(--accent-indigo) 70%, /* 靛蓝 */
    var(--accent) 90%, /* 量子青 */
    transparent 100% /* 底部完全透明 */
  );
  background-size: 100% 200%; /* 纵向双倍尺寸，用于动画平移 */
  animation: light-strip-shift 5s ease-in-out infinite; /* 光带上下流动动画 */
  opacity: 0.55; /* 半透明光带 */
  filter: blur(0.5px); /* 轻微模糊模拟辉光扩散 */
  box-shadow: 0 0 8px rgba(0, 229, 216, 0.15), 0 0 20px rgba(99, 102, 241, 0.08); /* 光带外发光 */
  pointer-events: none; /* 不阻挡鼠标事件 */
}

/* Tron 光带上下流动关键帧 */
@keyframes light-strip-shift {
  0%, 100% { background-position: 0% 0%; } /* 起始/结束位置 */
  50% { background-position: 0% 100%; } /* 中点位置：移到下方 */
}

/* ── 品牌区域：脉冲辉光背景 ── */
.sidebar-brand {
  position: relative; /* 为 ::before 伪元素提供定位参考 */
  padding: 28px 24px 20px; /* 上右下左内边距 */
  cursor: pointer; /* 可点击跳转首页 */
  display: flex;
  align-items: center; /* 垂直居中 */
  gap: 10px; /* 图标与文字间距 */
}

/* 品牌背景脉冲光晕 */
.sidebar-brand::before {
  content: ''; /* 必须设置内容 */
  position: absolute;
  inset: 10px -4px 8px -4px; /* 比内容区略微扩大 */
  border-radius: 16px; /* 圆角矩形光圈 */
  /* 径向渐变：中心量子青 → 边缘透明 */
  background: radial-gradient(
    ellipse at center,
    rgba(0, 229, 216, 0.12) 0%, /* 中心量子青光晕 */
    rgba(99, 102, 241, 0.06) 40%, /* 过渡靛蓝 */
    transparent 70% /* 边缘完全透明 */
  );
  animation: brand-pulse 3s ease-in-out infinite; /* 脉冲呼吸动画 */
  pointer-events: none; /* 穿透鼠标事件 */
  z-index: -1; /* 置于内容下方 */
}

/* 品牌脉冲关键帧 */
@keyframes brand-pulse {
  0%, 100% { opacity: 0.35; transform: scale(1); } /* 暗态 */
  50% { opacity: 0.75; transform: scale(1.03); } /* 亮态：微放大 + 增亮 */
}

/* 品牌图标 */
.brand-icon {
  font-size: 22px; /* 图标尺寸 */
  filter: drop-shadow(0 0 6px rgba(0, 229, 216, 0.4)); /* 图标外发光 */
  animation: icon-glow 2.5s ease-in-out infinite; /* 图标辉光呼吸 */
}

/* 图标辉光呼吸关键帧 */
@keyframes icon-glow {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(0, 229, 216, 0.3)); } /* 弱辉光 */
  50% { filter: drop-shadow(0 0 14px rgba(0, 229, 216, 0.65)); } /* 强辉光 */
}

/* 品牌文字：渐变色裁剪 */
.brand-text {
  font-size: 20px; /* 品牌文字大小 */
  font-weight: 700; /* 粗体 */
  /* 三色渐变：量子青 → 蓝 → 紫 */
  background: linear-gradient(
    135deg,
    var(--accent) 0%, /* 量子青 */
    var(--accent-blue) 50%, /* 蓝色 */
    var(--accent-purple) 100% /* 紫色 */
  );
  background-size: 200% 200%; /* 扩大背景用于动画 */
  -webkit-background-clip: text; /* WebKit 文字裁剪 */
  -webkit-text-fill-color: transparent; /* 文字透明以显示背景渐变 */
  background-clip: text; /* 标准文字裁剪 */
  letter-spacing: 1px; /* 字间距 */
  animation: brand-text-shift 4s ease-in-out infinite; /* 文字渐变流动 */
}

/* 品牌文字渐变流动关键帧 */
@keyframes brand-text-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* ── 导航菜单容器 ── */
.sidebar-menu {
  flex: 1; /* 占据剩余垂直空间 */
  padding: 0 12px; /* 左右内边距 */
  overflow-y: auto; /* 菜单项过多时垂直滚动 */
  overflow-x: hidden; /* 隐藏横向溢出（扫描效果需要） */
}

/* ── 导航条目：扫描悬停效果的核心 ── */
.nav-item {
  position: relative; /* 为 ::before 扫描光束提供定位参考 */
  display: flex;
  align-items: center; /* 图标文字垂直居中 */
  gap: 12px; /* 图标与文字间距 */
  padding: 12px 16px; /* 上下内边距 */
  margin-bottom: 4px; /* 条目间距 */
  border-radius: 12px; /* 圆角 */
  color: var(--text-secondary); /* 默认次要文字色 */
  text-decoration: none; /* 去除下划线 */
  font-size: 15px; /* 文字大小 */
  /* 科技风格等宽字体栈 */
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Courier New', monospace;
  letter-spacing: 0.4px; /* 微调字间距增加科技感 */
  transition: color 0.35s ease, transform 0.35s ease; /* 颜色和位移平滑过渡 */
  overflow: hidden; /* 裁剪扫描光束溢出 */
  z-index: 0; /* 创建层叠上下文 */
}

/* 扫描光束伪元素：悬停时从左向右扫过 */
.nav-item::before {
  content: ''; /* 必须设置内容 */
  position: absolute;
  inset: 0; /* 覆盖整个条目区域 */
  border-radius: inherit; /* 继承父元素圆角 */
  /* 扫描光束渐变：透明 → 量子青光 → 靛蓝 → 量子青光 → 透明 */
  background: linear-gradient(
    90deg,
    transparent 0%, /* 左端透明 */
    rgba(0, 229, 216, 0.04) 25%, /* 左四分之一微光 */
    rgba(99, 102, 241, 0.1) 50%, /* 中心高亮 */
    rgba(0, 229, 216, 0.04) 75%, /* 右四分之一微光 */
    transparent 100% /* 右端透明 */
  );
  background-size: 200% 100%; /* 双倍宽度用于位置动画 */
  background-position: -100% 0; /* 默认隐藏在左侧 */
  transition: background-position 0.6s cubic-bezier(0.4, 0, 0.2, 1); /* 使用缓动曲线 */
  z-index: -1; /* 置于内容下方 */
  pointer-events: none; /* 穿透鼠标事件 */
}

/* 悬停触发扫描光束扫入 */
.nav-item:hover::before {
  background-position: 100% 0; /* 光束移到右侧 */
}

/* 悬停文字颜色提升 + 微右移 */
.nav-item:hover {
  color: var(--text-primary); /* 主文字色 */
  transform: translateX(4px); /* 向右微移 4px */
}

/* 导航图标默认样式 */
.nav-icon {
  font-size: 18px; /* 图标大小 */
  width: 24px; /* 固定宽度保证对齐 */
  text-align: center; /* 水平居中 */
  transition: transform 0.35s ease, filter 0.35s ease; /* 缩放和辉光平滑过渡 */
}

/* 悬停时图标放大 + 辉光 */
.nav-item:hover .nav-icon {
  transform: scale(1.18); /* 放大 18% */
  filter: drop-shadow(0 0 6px rgba(0, 229, 216, 0.55)); /* 量子青辉光 */
}

/* ── 激活态：辉光边框 + 脉冲动画 ── */
.nav-active {
  background: rgba(0, 229, 216, 0.1); /* 量子青半透明背景 */
  color: var(--accent); /* 量子青文字色 */
  font-weight: 600; /* 半粗体 */
  text-shadow: 0 0 10px rgba(0, 229, 216, 0.3); /* 文字辉光 */
  /* 双层辉光：外发光 + 内发光 */
  box-shadow:
    0 0 14px rgba(0, 229, 216, 0.12), /* 外发光 */
    inset 0 0 14px rgba(0, 229, 216, 0.05); /* 内发光 */
  animation: active-pulse 2.5s ease-in-out infinite; /* 脉冲呼吸动画 */
}

/* 激活态脉冲关键帧 */
@keyframes active-pulse {
  0%, 100% {
    box-shadow: 0 0 8px rgba(0, 229, 216, 0.08), inset 0 0 8px rgba(0, 229, 216, 0.03); /* 弱辉光 */
    background: rgba(0, 229, 216, 0.08); /* 较浅背景 */
  }
  50% {
    box-shadow: 0 0 22px rgba(0, 229, 216, 0.2), inset 0 0 18px rgba(0, 229, 216, 0.08); /* 强辉光 */
    background: rgba(0, 229, 216, 0.14); /* 较深背景 */
  }
}

/* 激活态图标增强 */
.nav-active .nav-icon {
  filter: drop-shadow(0 0 10px rgba(0, 229, 216, 0.65)); /* 强辉光图标 */
  transform: scale(1.08); /* 微放大 */
}

/* 激活态固定显示扫描光束 */
.nav-active::before {
  /* 更温和的常亮光束 */
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 229, 216, 0.06) 50%,
    transparent 100%
  );
  background-position: 100% 0; /* 保持光束在右侧 */
  animation: active-beam-shift 4s ease-in-out infinite; /* 光束循环往复 */
}

/* 激活态光束往复关键帧 */
@keyframes active-beam-shift {
  0%, 100% { background-position: 100% 0; } /* 右端 */
  25% { background-position: 50% 0; } /* 中间 */
  50% { background-position: 0% 0; } /* 左端 */
  75% { background-position: 50% 0; } /* 回到中间 */
}

/* ── 底部登出区域 ── */
.sidebar-footer {
  padding: 16px 24px; /* 内边距 */
  border-top: 1px solid var(--border-glow); /* 顶部分隔线 */
}

/* ── 登出按钮：危险的优雅 —— 红色扫描光束 + 辉光 ── */
.logout-btn {
  position: relative; /* 为 ::before 扫描光束提供定位参考 */
  width: 100%; /* 撑满容器 */
  padding: 10px; /* 内边距 */
  background: transparent; /* 默认透明背景 */
  color: var(--text-secondary); /* 默认次要文字颜色 */
  border: 1px solid rgba(239, 68, 68, 0.18); /* 淡红色边框 */
  border-radius: 10px; /* 圆角 */
  font-size: 14px; /* 字体大小 */
  font-family: inherit; /* 继承父级字体 */
  cursor: pointer; /* 鼠标指针 */
  transition: all 0.35s ease; /* 全属性平滑过渡 */
  overflow: hidden; /* 裁剪扫描光束溢出 */
  z-index: 0; /* 创建层叠上下文 */
}

/* 登出按钮悬停扫描红线 */
.logout-btn::before {
  content: ''; /* 必须设置内容 */
  position: absolute;
  inset: 0; /* 覆盖整个按钮 */
  /* 红色扫描光束 */
  background: linear-gradient(
    90deg,
    transparent 0%, /* 左端透明 */
    rgba(239, 68, 68, 0.06) 40%, /* 淡红光 */
    rgba(239, 68, 68, 0.12) 50%, /* 中心高亮 */
    rgba(239, 68, 68, 0.06) 60%, /* 淡红光 */
    transparent 100% /* 右端透明 */
  );
  background-size: 200% 100%; /* 双倍宽度 */
  background-position: -100% 0; /* 默认隐藏在左侧 */
  transition: background-position 0.6s cubic-bezier(0.4, 0, 0.2, 1); /* 缓动扫描 */
  z-index: -1; /* 置于内容下方 */
}

/* 悬停状态：红色边框 + 辉光文字 + 外发光 */
.logout-btn:hover {
  background: rgba(239, 68, 68, 0.07); /* 淡红色背景 */
  border-color: rgba(239, 68, 68, 0.55); /* 加深红色边框 */
  color: #FCA5A5; /* 浅红色文字 */
  text-shadow: 0 0 14px rgba(239, 68, 68, 0.45); /* 红色文字辉光 */
  /* 双层红色辉光 */
  box-shadow:
    0 0 24px rgba(239, 68, 68, 0.18), /* 外发光 */
    inset 0 0 24px rgba(239, 68, 68, 0.05); /* 内发光 */
}

/* 悬停触发红色扫描光束 */
.logout-btn:hover::before {
  background-position: 100% 0; /* 红色光束扫入 */
}

/* 按下：微缩反馈 */
.logout-btn:active {
  transform: scale(0.96); /* 缩小 4% */
  transition: transform 0.1s ease; /* 快速缩放过渡 */
}

/* ── 菜单滚动条自定义（适配深色玻璃侧边栏）── */
.sidebar-menu::-webkit-scrollbar {
  width: 4px; /* 细滚动条 */
}

.sidebar-menu::-webkit-scrollbar-track {
  background: transparent; /* 透明轨道 */
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: rgba(0, 229, 216, 0.12); /* 量子青半透明滑块 */
  border-radius: 2px; /* 小圆角 */
  transition: background 0.3s ease; /* 滑块颜色过渡 */
}

.sidebar-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 229, 216, 0.28); /* 悬停加深 */
}
</style>
