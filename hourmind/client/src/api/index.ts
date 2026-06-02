// client/src/api/index.ts
// 前端 API 封装 —— 统一请求方法，通过 Vite 代理转发到后端 8000
const BASE = '/api'  // Vite 代理到 FastAPI 8000

export async function api(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}
