// ============================================================
// index.ts —— 后端入口文件（整个后端从这个文件启动）
//
// 启动流程（按代码顺序）：
//   1. 加载 .env 环境变量文件（JWT_SECRET、ENCRYPTION_KEY 等）
//   2. 创建 Express HTTP 服务器
//   3. 配置 CORS 跨域（允许前端 localhost:5173 访问）
//   4. 注册健康检查接口 GET /api/health
//   5. 导入所有 handler 文件（触发 registerRoute 注册路由）
//   6. 创建 WebSocket 服务，挂在 HTTP 服务器上（共用端口 3000）
//   7. 监听 3000 端口，启动成功打印日志
//
// 为什么 handler 只需要 import 就行？
//   每个 handler 文件在顶层调用了 registerRoute('action', handler)，
//   import 时这些代码就会执行，把 action→handler 映射注册到 wsRouter。
//   这就是"副作用导入"（side-effect import）：不是为了用导出值，
//   而是为了触发文件中的注册逻辑。
// ============================================================

// dotenv：从 .env 文件加载环境变量到 process.env
// 必须在最开头调用，因为后续模块可能依赖环境变量
import dotenv from 'dotenv'
dotenv.config() // 执行后 process.env.JWT_SECRET 等就有了值

// express：Node.js 最流行的 HTTP 框架
// 用来提供 REST API（如健康检查 /api/health）
import express from 'express'
// cors：跨域资源共享中间件
// 浏览器默认禁止跨域请求，cors 中间件允许前端 localhost:5173 访问后端 localhost:3000
import cors from 'cors'
// http：Node.js 内置模块，createServer 创建 HTTP 服务器
import http from 'http'
// WebSocket 服务创建函数（来自 wsServer.ts）
import { createWsServer } from './wsServer'

// ==================== 导入 Handler（副作用导入）====================
// 下面每个 import 都会触发对应文件的顶层代码执行，
// 其中包含 registerRoute() 调用，把 action 注册到 wsRouter 的路由表。
// 如果不 import，对应的 handler 就不会注册，客户端发来 action 会返回 UNKNOWN_ACTION。
import './handlers/authHandler' // auth.setup / auth.login / auth.check
import './handlers/keyHandler' // providers.list / keys.* / ...
import './handlers/chatHandler' // conversations.* / messages.*
import './handlers/dashboardHandler' // dashboard.summary
import './handlers/historyHandler' // history.*
import './handlers/settingsHandler' // settings.get / settings.update

// ==================== 创建 Express 应用 ====================
const app = express()

// 配置 CORS（跨域资源共享）
// origin: [...] 白名单，只允许这两个地址的请求
// credentials: true 允许携带 Cookie/Authorization 头
app.use(
  cors({
    origin: [
      'http://localhost:5173', // Vite 默认地址
      'http://127.0.0.1:5173', // 同上（有些人用 127.0.0.1）
    ],
    credentials: true,
  }),
)

// 配置 JSON 解析中间件
// 自动把请求 body 中的 JSON 字符串解析成 JS 对象
// 之后在路由中通过 req.body 就能拿到解析好的对象
app.use(express.json())

// ==================== REST API 路由 ====================

// 健康检查接口
// GET /api/health → { status: "ok", time: "2026-05-28T..." }
// 用途：确认服务是否在运行，监控/负载均衡器常用
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ==================== 启动服务器 ====================

// http.createServer(app) 用 Express 应用创建 HTTP 服务器
// 返回一个 http.Server 实例
const server = http.createServer(app)

// 把 WebSocket 服务挂在 HTTP 服务器上
// WebSocket 和 HTTP 共用同一个端口（3000）
// WebSocket 走 /ws 路径，HTTP 走其他路径
createWsServer(server)

// 端口号：优先用环境变量 PORT，没有就默认 3000
// parseInt 把字符串 "3000" 转成数字 3000
const PORT = parseInt(process.env.PORT || '3000')

// server.listen(端口, 回调) — 启动服务器，开始监听
server.listen(PORT, () => {
  console.log(`🚀 HourMind 后端已启动`)
  console.log(`   HTTP:      http://localhost:${PORT}`)
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`)
})
