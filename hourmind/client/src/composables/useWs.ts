// useWs.ts —— WebSocket 客户端（全局单例，Promise 化）
// 用法：const result = await wsClient.send('keys.list')

const pending = new Map<string, { resolve: Function; reject: Function; timer: ReturnType<typeof setTimeout> }>()
let counter = 0
let ws: WebSocket | null = null
const pushHandlers = new Map<string, Set<Function>>()

function connect(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws) { ws.close(); ws = null }
    ws = new WebSocket(`ws://localhost:3000/ws?token=${encodeURIComponent(token)}`)
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('连接失败'))
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'response') {
        const entry = pending.get(msg.id)
        if (entry) { clearTimeout(entry.timer); pending.delete(msg.id); msg.success ? entry.resolve(msg.data) : entry.reject(msg.error) }
        return
      }
      pushHandlers.get(msg.type)?.forEach(h => h(msg))
    }
    ws.onclose = () => { pending.forEach(e => { clearTimeout(e.timer); e.reject({ code: 'DISCONNECTED' }) }); pending.clear() }
  })
}

function send<T = any>(action: string, payload: any = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `req_${++counter}`
    const timer = setTimeout(() => { pending.delete(id); reject({ code: 'TIMEOUT', message: '请求超时' }) }, 10000)
    pending.set(id, { resolve, reject, timer })
    ws!.send(JSON.stringify({ id, type: 'request', action, payload }))
  })
}

function onPush(type: string, handler: (data: any) => void) {
  if (!pushHandlers.has(type)) pushHandlers.set(type, new Set())
  pushHandlers.get(type)!.add(handler)
}
function offPush(type: string, handler: (data: any) => void) {
  pushHandlers.get(type)?.delete(handler)
}

export const wsClient = { connect, send, onPush, offPush }
