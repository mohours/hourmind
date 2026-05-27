// wsServer.ts —— WebSocket 服务
// 把 WebSocket 服务挂在 HTTP 服务器上，监听客户端连接和消息
import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import { parse } from 'url'
import { handleMessage } from './wsRouter'

export function createWsServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', (ws: WebSocket, req) => {
    // 从 URL 参数中提取 token（ws://host/ws?token=xxx）
    const urlParams = parse(req.url || '', true)
    const token = urlParams.query.token as string

    console.log('🔌 客户端连接', token ? '(已提供Token)' : '(无Token)')

    ws.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString())
        if (msg.type === 'request') {
          // 传入 ws 对象，让 handler 可以推送流式帧
          const response = await handleMessage(msg.action, msg.payload, token, ws)
          ws.send(JSON.stringify({
            id: msg.id, type: 'response',
            success: response.success, data: response.data, error: response.error,
          }))
        }
      } catch {
        ws.send(JSON.stringify({
          id: '', type: 'response', success: false,
          error: { code: 'PARSE_ERROR', message: '消息格式错误' },
        }))
      }
    })

    ws.on('close', () => console.log('🔌 客户端断开'))
    ws.send(JSON.stringify({ id: '', type: 'response', success: true, data: { message: '连接成功' } }))
  })

  console.log('✅ WebSocket 已就绪，路径: /ws')
}
