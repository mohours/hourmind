// useWs.ts —— WebSocket 客户端（全局单例，Promise 化）
// 用法：const result = await wsClient.send('keys.list')
const pending = new Map();
let counter = 0;
let ws = null;
const pushHandlers = new Map();
function connect(token) {
    return new Promise((resolve, reject) => {
        if (ws) {
            ws.close();
            ws = null;
        }
        ws = new WebSocket(`ws://localhost:3000/ws?token=${encodeURIComponent(token)}`);
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('连接失败'));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'response') {
                const entry = pending.get(msg.id);
                if (entry) {
                    clearTimeout(entry.timer);
                    pending.delete(msg.id);
                    msg.success ? entry.resolve(msg.data) : entry.reject(msg.error);
                }
                return;
            }
            pushHandlers.get(msg.type)?.forEach(h => h(msg));
        };
        ws.onclose = () => { pending.forEach(e => { clearTimeout(e.timer); e.reject({ code: 'DISCONNECTED' }); }); pending.clear(); };
    });
}
function send(action, payload = {}) {
    return new Promise((resolve, reject) => {
        const id = `req_${++counter}`;
        const timer = setTimeout(() => { pending.delete(id); reject({ code: 'TIMEOUT', message: '请求超时' }); }, 10000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, type: 'request', action, payload }));
    });
}
function onPush(type, handler) {
    if (!pushHandlers.has(type))
        pushHandlers.set(type, new Set());
    pushHandlers.get(type).add(handler);
}
function offPush(type, handler) {
    pushHandlers.get(type)?.delete(handler);
}
export const wsClient = { connect, send, onPush, offPush };
