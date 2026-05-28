// ============================================================
// useWs.ts —— WebSocket 客户端（全局单例）
//
// 这是前端与后端通信的唯一通道。所有 API 调用都通过这个文件。
//
// 核心设计：Promise 化的请求-响应模式
//   send('keys.list') → 返回 Promise → await 拿到结果
//   看起来像普通 HTTP 请求，但底层是 WebSocket
//
// 工作原理：
//   1. connect(token) — 建立 WebSocket 连接到 ws://localhost:3000/ws?token=xxx
//   2. send(action, payload) — 发请求帧 { id, type:'request', action, payload }
//   3. 服务端返回响应帧 { id, type:'response', success, data }
//   4. 根据 id 匹配 pending 中的 Promise → resolve/reject
//   5. 10 秒超时 → 自动 reject
//
// 推送监听（流式对话用）：
//   onPush('stream_chunk', handler)  — 监听服务端推送的流式帧
//   offPush('stream_chunk', handler) — 取消监听
//
// 帧格式：
//   请求帧：{ id:"req_1", type:"request", action:"keys.list", payload:{} }
//   响应帧：{ id:"req_1", type:"response", success:true, data:[...] }
//   推送帧：{ type:"stream_chunk", message_id:"yyy", chunk:"你好" }  ← 没有 id
// ============================================================

// pending：存所有等待响应的 Promise
// key = 请求 id（如 "req_1"），value = { resolve, reject, timer }
const pending = new Map<string, {
  resolve: Function    // Promise 的 resolve，调它表示成功
  reject: Function     // Promise 的 reject，调它表示失败
  timer: ReturnType<typeof setTimeout>  // 超时定时器 ID
}>()

// counter：自增计数器，生成唯一的请求 id
let counter = 0

// ws：WebSocket 连接实例（全局只有一个）
let ws: WebSocket | null = null

// pushHandlers：推送事件监听器
// key = 事件类型（如 "stream_chunk"），value = 处理函数集合
const pushHandlers = new Map<string, Set<Function>>()

// ==================== connect ====================
// 建立 WebSocket 连接
// @param token — JWT Token（认证用，从 URL 查询参数传给服务端）
// @returns Promise，连接成功 resolve，失败 reject
function connect(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 如果已有连接，先关掉（切换账号/重连场景）
    if (ws) {
      ws.close()
      ws = null
    }

    // 创建 WebSocket 连接
    // encodeURIComponent 对 token 做 URL 编码（处理特殊字符）
    ws = new WebSocket(`ws://localhost:3000/ws?token=${encodeURIComponent(token)}`)

    // 连接成功 → resolve Promise
    ws.onopen = () => resolve()

    // 连接失败 → reject Promise
    ws.onerror = () => reject(new Error('连接失败'))

    // 收到消息时处理
    ws.onmessage = (event) => {
      // 解析 JSON 消息
      const msg = JSON.parse(event.data)

      // 判断帧类型：有 id = 响应帧，没 id = 推送帧
      if (msg.type === 'response') {
        // ——— 响应帧：匹配 pending 中的请求 ———
        const entry = pending.get(msg.id) // 根据 id 找到对应的 Promise
        if (entry) {
          clearTimeout(entry.timer)    // 清除超时定时器
          pending.delete(msg.id)       // 从 pending 中移除
          // success=true → resolve(data)，否则 → reject(error)
          msg.success ? entry.resolve(msg.data) : entry.reject(msg.error)
        }
        return // 响应帧处理完毕
      }

      // ——— 推送帧：通知所有监听该类型的 handler ———
      // pushHandlers.get(msg.type) 取出该类型的 handler 集合
      // ?.forEach 如果集合存在则遍历调用每个 handler
      pushHandlers.get(msg.type)?.forEach(h => h(msg))
    }

    // WebSocket 断开 → 把所有 pending 请求都 reject
    ws.onclose = () => {
      pending.forEach(e => {
        clearTimeout(e.timer)                            // 清除定时器
        e.reject({ code: 'DISCONNECTED' })               // reject 所有等待中的请求
      })
      pending.clear()                                     // 清空 pending
    }
  })
}

// ==================== send ====================
// 发送请求，返回 Promise
// @param action  — 操作名称，如 "keys.list"
// @param payload — 请求参数（可选，默认空对象）
// @returns Promise<T>，resolve 时拿到服务端返回的 data
function send<T = any>(action: string, payload: any = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    // 生成唯一请求 id（自增计数器 + "req_" 前缀）
    const id = `req_${++counter}`

    // 创建超时定时器：10 秒没响应就 reject
    const timer = setTimeout(() => {
      pending.delete(id)                                   // 从 pending 移除
      reject({ code: 'TIMEOUT', message: '请求超时' })      // reject Promise
    }, 10000)

    // 把 Promise 的 resolve/reject 和定时器存入 pending
    pending.set(id, { resolve, reject, timer })

    // 通过 WebSocket 发送请求帧
    // JSON.stringify 把对象转成 JSON 字符串
    ws!.send(JSON.stringify({ id, type: 'request', action, payload }))
  })
}

// ==================== onPush / offPush ====================
// 监听服务端推送（流式对话用）
// @param type    — 推送类型，如 "stream_chunk" / "stream_end" / "stream_error"
// @param handler — 回调函数，收到推送时调用
function onPush(type: string, handler: (data: any) => void) {
  // 如果该类型还没有 handler 集合，先创建一个
  if (!pushHandlers.has(type)) {
    pushHandlers.set(type, new Set())
  }
  // 把 handler 加入集合
  pushHandlers.get(type)!.add(handler)
}

// 取消监听
function offPush(type: string, handler: (data: any) => void) {
  pushHandlers.get(type)?.delete(handler) // 从集合中移除
}

// 导出全局单例 wsClient
// 整个应用只有这一个 WebSocket 连接
export const wsClient = { connect, send, onPush, offPush }
