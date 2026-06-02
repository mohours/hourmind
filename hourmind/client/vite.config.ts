// client/vite.config.ts
// Vite 配置 —— 端口 5173，@ 别名指向 src/，API 代理到后端 8000
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),   // @ 别名 → src/ 目录
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',  // REST API 代理到后端
      '/ws': { target: 'ws://localhost:8000', ws: true },  // WebSocket 代理到后端
    },
  },
})
