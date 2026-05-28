// ============================================================
// wsServer.ts —— WebSocket 服务端
//
// 这个文件负责：
//   1. 创建 WebSocket 服务，挂载到 HTTP 服务器上
//   2. 监听客户端连接，每个连接代表一个用户
//   3. 接收客户端消息 → 解析 → 调 wsRouter.handleMessage() 分发
//   4. 把 handler 的返回结果包装成响应帧发回客户端
//
// WebSocket 通信协议（自定）：
//
//   客户端发来的请求帧格式：
//     { id: "req_001", type: "request", action: "keys.list", payload: {...} }
//       ↑ 请求唯一ID   ↑ 固定值       ↑ 操作名称              ↑ 参数
//
//   服务端返回的响应帧格式：
//     { id: "req_001", type: "response", success: true, data: {...} }
//       ↑ 与请求ID一致  ↑ 固定值
//
//   服务端主动推送的帧格式（流式对话）：
//     { type: "stream_chunk", message_id: "yyy", chunk: "你好" }
//       ↑ 没有 id 字段（不参与请求-响应匹配）
//
// 为什么用 WebSocket 而不是 HTTP REST？
//   1. 流式对话需要服务端持续推送数据，HTTP 请求-响应模式做不到
//   2. 一条 WebSocket 连接处理所有通信，避免反复握手开销
//   3. 全双工通信，服务端可以随时推送（如通知、状态更新）
// ============================================================

// WebSocketServer = 服务端，WebSocket = 单个连接的类型
import { WebSocketServer, WebSocket } from 'ws'
// http.Server 类型，用于把 WebSocket 挂到 HTTP 上
import type { Server } from 'http'
// Node.js url 模块的 parse 函数，用于解析 URL 中的查询参数
import { parse } from 'url'
// 消息分发函数（来自 wsRouter.ts）
import { handleMessage } from './wsRouter'

// 创建 WebSocket 服务并挂载到 HTTP 服务器
// @param httpServer — Express 创建的 HTTP 服务器实例
export function createWsServer(httpServer: Server) {
  // 创建 WebSocketServer 实例
  // server: httpServer  → 共用同一个端口（3000）
  // path: '/ws'         → WebSocket 连接路径（ws://localhost:3000/ws?token=xxx）
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  // 监听新客户端连接事件
  // wss.on('connection', callback) — 每有一个客户端连上来，就执行一次 callback
  // ws 参数代表这个客户端的连接对象，可以收发消息
  wss.on('connection', (ws: WebSocket, req) => {
    // ==================== 1. 提取 Token ====================
    // req.url 是客户端连接时的完整 URL，如 "/ws?token=eyJhbG..."
    // parse(url, true) 解析 URL，true 表示把查询参数也解析成对象
    // query.token 取出 token 参数的值
    const urlParams = parse(req.url || '', true)
    const token = urlParams.query.token as string // as string 类型断言

    console.log('🔌 客户端连接', token ? '(已提供Token)' : '(无Token)')

    // ==================== 2. 监听消息 ====================
    // ws.on('message', callback) — 客户端发来消息时触发
    // rawData 是原始二进制数据
    ws.on('message', async (rawData) => {
      let msg: any = null // 在外面声明，catch 里也能用到 msg.id
      try {
        // rawData.toString() 把二进制 Buffer 转成字符串
        // JSON.parse() 把 JSON 字符串转成 JS 对象
        msg = JSON.parse(rawData.toString())

        // 只处理 type='request' 的帧（客户端主动请求）
        // 其他 type 的可能以后扩展
        if (msg.type === 'request') {
          // 调 wsRouter.handleMessage() 找到 handler 并执行
          // 传入：action 名称、payload 参数、Token、WebSocket 连接
          const response = await handleMessage(
            msg.action,
            msg.payload,
            token,
            ws,
          )

          // 把 handler 返回的 WsResponse 包装成响应帧发给客户端
          // id 原样返回，让客户端知道这是哪次请求的回复
          // type: 'response' 标记这是响应帧（区别于推送帧）
          ws.send(
            JSON.stringify({
              id: msg.id, // 请求 ID，原样返回
              type: 'response', // 帧类型：响应
              success: response.success, // 成功或失败
              data: response.data, // 成功时的数据
              error: response.error, // 失败时的错误信息
            }),
          )
        }
      } catch (e: any) {
        // 出错：打印完整错误堆栈到控制台，方便排查
        console.error('❌ WS 消息处理失败:', e.message || e)
        console.error('   原始消息:', rawData.toString().slice(0, 500))

        // 尽量保留 id，让前端能匹配到这次请求（而不是卡住等超时）
        const reqId = msg?.id || ''

        ws.send(
          JSON.stringify({
            id: reqId, // 尽可能保留请求 id
            type: 'response',
            success: false,
            error: {
              code: e.code || 'INTERNAL_ERROR',
              message: e.message || '服务器内部错误',
            },
          }),
        )
      }
    })

    // ==================== 3. 监听断开 ====================
    // 客户端关闭连接时触发
    ws.on('close', () => {
      console.log('🔌 客户端断开')
    })

    // ==================== 4. 发送连接成功 ====================
    // 连接建立后立即发一条欢迎消息
    // 前端可以用这条消息确认 WebSocket 连接已就绪
    ws.send(
      JSON.stringify({
        id: '', // 没有对应的请求，id 为空
        type: 'response',
        success: true,
        data: { message: '连接成功' },
      }),
    )
  })

  console.log('✅ WebSocket 已就绪，路径: /ws')
}
