// index.ts —— 后端入口文件
// 加载环境变量 → 启动 Express → 启动 WebSocket → 监听端口
import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import http from 'http'
import { createWsServer } from './wsServer'

// 导入所有 handler（触发 registerRoute 注册路由）
// 这些 import 的副作用就是注册 action → handler 映射
import './handlers/authHandler'
import './handlers/keyHandler'
import './handlers/chatHandler'
import './handlers/dashboardHandler'
import './handlers/historyHandler'

const app = express()
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }))
app.use(express.json())

// 健康检查接口
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

const server = http.createServer(app)
createWsServer(server)

const PORT = parseInt(process.env.PORT || '3000')
server.listen(PORT, () => {
  console.log(`🚀 HourMind 后端已启动`)
  console.log(`   HTTP:      http://localhost:${PORT}`)
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`)
})
