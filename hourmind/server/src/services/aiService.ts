// aiService.ts —— 调用 AI 厂商 API
import { decrypt } from './cryptoService'

// 测试 Key 连通性（调 /models 接口，不消耗 Token）
export async function testKeyConnection(baseUrl: string, encryptedKey: string) {
  let apiKey: string
  try { apiKey = decrypt(encryptedKey) } catch { return { success: false, latencyMs: 0, errorMessage: 'Key 解密失败' } }
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/models`, { headers: { 'Authorization': `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000) })
    const latencyMs = Date.now() - start
    if (res.ok) return { success: true, latencyMs }
    const body = await res.text()
    return { success: false, latencyMs, errorMessage: `HTTP ${res.status}: ${body.slice(0,200)}` }
  } catch (e: any) {
    return { success: false, latencyMs: Date.now() - start, errorMessage: e.name==='TimeoutError'?'连接超时':`网络错误:${e.message}` }
  }
}

// 流式对话：逐 token 推送回复
export function streamChat(
  baseUrl: string, encryptedKey: string, model: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onDone: (totalTokens: number) => void,
  onError: (error: string) => void,
): () => void {
  let apiKey: string; try { apiKey = decrypt(encryptedKey) } catch { onError('Key 解密失败'); return ()=>{} }
  const controller = new AbortController()
  ;(async () => {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true }),
        signal: controller.signal,
      })
      if (!res.ok) { const b = await res.text(); onError(`API 错误(${res.status}): ${b.slice(0,300)}`); return }
      const reader = res.body!.getReader(); const decoder = new TextDecoder()
      let totalTokens = 0; let buffer = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() || ''
        for (const line of lines) {
          const t = line.trim(); if (!t || !t.startsWith('data: ')) continue
          const ds = t.slice(6); if (ds === '[DONE]') continue
          try { const d = JSON.parse(ds); const delta = d.choices?.[0]?.delta; if (delta?.content) onChunk(delta.content); if (d.usage?.total_tokens) totalTokens = d.usage.total_tokens } catch {}
        }
      }
      onDone(totalTokens)
    } catch (e: any) { if (e.name!=='AbortError') onError(e.name==='TimeoutError'?'请求超时':`网络错误:${e.message}`) }
  })()
  return () => controller.abort()
}

// summarizeChat —— 非流式 AI 会话总结
// 取全部消息 → 拼接 system prompt → 调厂商 API → 返回 200 字以内中文摘要
export async function summarizeChat(
  baseUrl: string,                       // 厂商 API 地址
  encryptedKey: string,                  // 加密的 API Key
  model: string,                         // 模型名
  messages: { role: string; content: string }[]  // 会话全部消息
): Promise<string> {
  // 解密 Key
  let apiKey: string
  try { apiKey = decrypt(encryptedKey) } catch { return '[错误] Key 解密失败' }

  // 构造 system prompt：让 AI 用中文生成 200 字以内的会话摘要
  const systemMsg = {
    role: 'system',
    content: '请用中文生成一段200字以内的会话摘要，概括这段对话的主要内容和结论。只输出摘要本身，不要加任何前缀或说明。'
  }

  try {
    // 调厂商 /chat/completions，非流式（stream: false）
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [systemMsg, ...messages],  // system + 全部历史消息
        stream: false,                       // 非流式，一次性返回
        max_tokens: 400,                     // 限制输出长度（200字约400 token）
      }),
      signal: AbortSignal.timeout(30000),    // 30 秒超时
    })

    // 请求失败
    if (!res.ok) {
      const body = await res.text()
      console.error('[summarizeChat] API 错误:', res.status, body.slice(0, 200))
      return '[错误] 摘要生成失败'
    }

    // 解析响应
    const data = await res.json() as any
    // 取 choices[0].message.content
    const summary = data.choices?.[0]?.message?.content || ''
    return summary.trim()
  } catch (e: any) {
    // 超时或网络错误
    console.error('[summarizeChat] 异常:', e.message)
    return '[错误] 摘要请求失败'
  }
}
