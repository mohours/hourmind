// ============================================================
// vite.config.ts —— Vite 构建工具配置
//
// Vite 是什么？
//   一个前端构建工具（替代 Webpack），由 Vue 的作者尤雨溪开发。
//   它的工作：开发时提供热更新服务器，打包时把 .vue/.ts/.css 编译成浏览器能跑的 .js/.css。
//
// 为什么叫 Vite？
//   法语"快"的意思。利用浏览器原生 ES Module 实现极快冷启动，
//   不像 Webpack 需要先打包再启动。
//
// 配置的主要内容：
//   1. plugins      — 安装什么插件（Vue 支持）
//   2. resolve.alias — 路径别名（@ → src）
//   3. server        — 开发服务器端口和代理
// ============================================================

// defineConfig：Vite 的配置函数，提供类型提示
import { defineConfig } from 'vite'
// @vitejs/plugin-vue：Vite 的 Vue 插件
// 作用：让 Vite 能编译 .vue 单文件组件（template + script + style）
import vue from '@vitejs/plugin-vue'
// path 模块：Node.js 内置模块，用于处理文件路径
import { resolve } from 'path'

export default defineConfig({
  // ==================== 插件 ====================
  plugins: [
    vue(),  // Vue 3 单文件组件编译插件
  ],

  // ==================== 路径解析 ====================
  resolve: {
    alias: {
      // 路径别名：代码里 import '@/stores/xxx' 等价于 import 'src/stores/xxx'
      // __dirname 是当前文件所在目录（即 client/）
      '@': resolve(__dirname, 'src'),
    },
  },

  // ==================== 开发服务器 ====================
  server: {
    port: 5173,  // 开发服务器端口号（浏览器访问 http://localhost:5173）

    // API 代理：把前端的 /api 请求转发到后端
    // 例如：前端 fetch('/api/health') → Vite 转发到 → http://localhost:3000/api/health
    // 好处：前端和后端"同源"，浏览器不会因为跨域（CORS）拦截
    proxy: {
      '/api': {
        target: 'http://localhost:3000',  // 转发目标（后端地址）
        changeOrigin: true,                // 修改请求头中的 origin（伪装成同源请求）
      },
    },
  },
})
