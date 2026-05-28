// ============================================================
// wsRouter.ts —— WebSocket Action 路由分发器（核心模块）
//
// 这个文件是整个后端通信的神经中枢。它做两件事：
//   1. 注册路由：把 action 名称（如 "keys.list"）和 handler 函数绑定
//   2. 分发消息：收到客户端消息后，根据 action 找到对应的 handler 执行
//
// 核心概念 — PushContext（推送上下文）：
//   普通请求是"客户端问 → 服务端答"，一次交互就结束了。
//   但流式对话不同：AI 生成是逐 token 的，需要服务端主动、持续推送。
//   PushContext 就是 handler 用来主动推送消息给客户端的通道。
//
//   例如对话时：
//     ctx.push('stream_chunk', { chunk: '你好' })  → 推送一个文本片段
//     ctx.push('stream_end',   { token_count: 42 }) → 推送流结束信号
//
// WsResponse 格式：
//   { success: true, data: {...} }                     ← 成功
//   { success: false, error: { code: '...', message: '...' } } ← 失败
// ============================================================

// WebSocket 类型（来自 ws 库），用于 PushContext 发送消息
import { WebSocket } from 'ws'

// ==================== PushContext ====================
// 推送上下文类
// handler 通过这个对象向客户端主动推送流式帧
//
// 使用方式（在 handler 内部）：
//   ctx?.push('stream_chunk', { message_id: 'xxx', chunk: '你好' })
//   ctx?.push('stream_end',   { message_id: 'xxx', token_count: 42 })
export class PushContext {
  // 构造函数：接收一个 WebSocket 连接对象
  // private ws 表示 ws 是这个类的私有属性，外部不能直接访问
  constructor(private ws: WebSocket) {}

  // push() 方法：向客户端推送一条消息
  // @param type  消息类型，如 'stream_chunk' / 'stream_end' / 'stream_error'
  // @param data  消息内容对象，会被展开到顶层
  //
  // 最终发送的 JSON 格式（注意 data 被展开）：
  //   { "type": "stream_chunk", "message_id": "xxx", "chunk": "你好" }
  //   ↑ type 字段固定       ↑ data 里的字段被合并进来
  push(type: string, data: any) {
    // readyState === WebSocket.OPEN 检查连接是否还开着
    // 如果客户端断开了（readyState 是 CLOSED/CLOSING），就不发了
    if (this.ws.readyState === WebSocket.OPEN) {
      // JSON.stringify 把 JS 对象转成 JSON 字符串
      // { type, ...data } 是对象展开语法，把 data 的字段合并到顶层
      this.ws.send(JSON.stringify({ type, ...data }))
    }
  }
}

// ==================== 类型定义 ====================

// WsResponse：所有 handler 返回的统一响应格式
export interface WsResponse {
  success: boolean // true=成功, false=失败
  data?: any // 成功时返回的数据（任意类型）
  error?: { code: string; message: string } // 失败时的错误码和提示信息
}

// Handler 函数签名类型
// (payload, token?, ctx?) → Promise<WsResponse>
//
// 参数说明：
//   payload — 客户端发来的请求参数（如 { keyId: 'xxx' }）
//   token   — 用户认证 Token（可选，WebSocket 连接时从 URL 参数提取）
//   ctx     — 推送上下文（可选，用于流式推送）
//
// 为什么是 Promise？
//   handler 内部通常有 await 数据库操作，所以返回 Promise
type Handler = (
  payload: any,
  token?: string,
  ctx?: PushContext,
) => Promise<WsResponse>

// ==================== 路由注册表 ====================

// routes 是一个键值对对象（字典/Map）
// key = action 名称字符串（如 "keys.list"）
// value = handler 函数
// 每个 handler 文件中的 registerRoute() 调用就是在往里添加条目
const routes: Record<string, Handler> = {}

// 注册路由：把 action 名称和 handler 函数绑定
// 各个 handler 文件会在文件加载时调用这个函数
// 例如 keyHandler.ts 中：registerRoute('keys.list', async (payload) => {...})
export function registerRoute(action: string, handler: Handler) {
  routes[action] = handler // 存入路由表
}

// ==================== 消息分发 ====================

// 收到客户端消息后，根据 action 找到对应 handler 并执行
// 这是整个通信流程的入口：wsServer.ts 收到消息后调这个函数
//
// @param action  — 操作名称，如 "keys.list"
// @param payload — 请求参数
// @param token   — 用户认证 Token
// @param ws      — WebSocket 连接对象（创建 PushContext 用）
// @returns WsResponse — handler 的返回值，wsServer.ts 会把它包装后发给客户端
export async function handleMessage(
  action: string,
  payload: any,
  token: string | undefined,
  ws: WebSocket,
): Promise<WsResponse> {
  // 从路由表中查找对应 action 的 handler
  const handler = routes[action]

  // 如果没找到注册的 handler → 说明客户端发了一个不存在的 action
  if (!handler) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ACTION',
        message: `未知操作: ${action}`,
      },
    }
  }

  // 创建推送上下文（把 WebSocket 连接包装成 PushContext 对象）
  // handler 可以通过 ctx.push() 向客户端推送流式帧
  const ctx = new PushContext(ws)

  // 执行 handler，传入参数
  // 正常的 handler 不需要 ctx（如 keys.list），直接忽略即可
  // 流式对话的 handler（如 messages.send）会用 ctx.push() 推送内容
  return handler(payload, token, ctx)
}
