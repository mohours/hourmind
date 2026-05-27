// ============================================================
// main.ts —— Vue 应用的入口文件
// 这是整个前端应用启动的第一个 JavaScript 文件
// 它负责：
//   1. 创建 Vue 应用实例
//   2. 安装插件（Pinia 状态管理、Vue Router 路由）
//   3. 挂载到 HTML 页面
//   4. 导入全局样式
// ============================================================
// createApp: Vue 3 的核心函数，创建一个 Vue 应用实例
import { createApp } from 'vue';
// createPinia: Pinia 的核心函数，创建全局状态管理器
// Pinia 就像一个"全局变量仓库"，所有组件都能读写
import { createPinia } from 'pinia';
// 导入路由配置（定义了 URL 和组件的映射关系）
import { router } from './router';
// 导入根组件（整个应用的"外壳"）
import App from './App.vue';
// 导入全局 CSS 样式（Quantum Glass 主题、玻璃卡片、按钮等）
import './style.css';
// 导入代码高亮的主题样式（dark 主题）
import 'highlight.js/styles/atom-one-dark.css';
// ==================== 创建应用实例 ====================
// createApp(App) 把 App.vue 作为根组件创建一个 Vue 应用
const app = createApp(App);
// ==================== 安装插件 ====================
// app.use() 安装插件，让整个应用都能使用该插件的功能
// Pinia：全局状态管理
// 安装后，任何组件都能 import { useXxxStore } from '@/stores/xxx' 来读写状态
app.use(createPinia());
// Vue Router：页面路由
// 安装后，URL 变化时 <router-view /> 会自动切换显示的页面组件
app.use(router);
// ==================== 挂载到 HTML ====================
// app.mount('#app') 把 Vue 应用"挂载"到 index.html 中的 <div id="app"></div>
// 此后 Vue 会接管 #app 内部的所有 DOM 操作
app.mount('#app');
