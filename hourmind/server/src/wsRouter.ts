// wsRouter.ts —— Action 路由分发器
// 根据 action 名称（如 "keys.list"）找到对应的 handler 并执行
import { WebSocket } from 'ws'

// 推送上下文：handler 用它来主动推送消息给客户端（流式对话用）
export class PushContext {
  constructor(private ws: WebSocket) {}
  push(type: string, data: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }))
    }
  }
}

export interface WsResponse {
  success: boolean
  data?: any
  error?: { code: string; message: string }
}

// handler 签名：接收 payload + token + push上下文，返回响应
type Handler = (payload: any, token?: string, ctx?: PushContext) => Promise<WsResponse>

const routes: Record<string, Handler> = {}

// 注册 action → handler 映射
export function registerRoute(action: string, handler: Handler) {
  routes[action] = handler
}

// 收到消息后根据 action 找到 handler 执行
export async function handleMessage(
  action: string, payload: any, token: string | undefined, ws: WebSocket
): Promise<WsResponse> {
  const handler = routes[action]
  if (!handler) {
    return { success: false, error: { code: 'UNKNOWN_ACTION', message: `未知操作: ${action}` } }
  }
  const ctx = new PushContext(ws)
  return handler(payload, token, ctx)
}
