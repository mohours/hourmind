// ============================================================
// aiService.ts —— AI 厂商 API 调用服务
//
// 这个文件是连接 HourMind 和 AI 厂商（OpenAI/Claude/DeepSeek 等）的桥梁。
// 所有对 AI 厂商的 HTTP 请求都在这里发出。
//
// 三个核心函数：
//   1. testKeyConnection  — 测试 Key 连通性（GET /models）
//   2. streamChat         — 流式对话（POST /chat/completions, stream=true）
//   3. summarizeChat      — AI 生成会话摘要（POST /chat/completions, stream=false）
//
// 关于兼容性：
//   所有厂商都兼容 OpenAI 的 API 格式（/models 和 /chat/completions），
//   所以这段代码对 OpenAI/DeepSeek/Moonshot/通义千问等通用接口都有效。
//   Anthropic 和 Google Gemini 的 API 格式不同，当前版本暂未适配。
// ============================================================

// 解密函数（AES-256-GCM 解密，从 cryptoService.ts 导入）
// 数据库里存的 Key 是加密的，调厂商 API 前需要解密成明文
import { decrypt } from './cryptoService'

// ==================== testKeyConnection ====================
// 测试 Key 连通性
// 原理：向厂商的 GET /models 接口发一个请求
//   成功 → 说明 Key 有效，记录响应延迟（毫秒）
//   失败 → 说明 Key 无效或网络不通
//
// @param baseUrl      — 厂商 API 基础地址，如 "https://api.openai.com/v1"
// @param encryptedKey — 数据库中加密存储的 Key
// @returns { success, latencyMs, errorMessage? }
export async function testKeyConnection(
  baseUrl: string,
  encryptedKey: string,
) {
  // -- 1. 解密 Key --
  let apiKey: string // 明文 Key
  try {
    apiKey = decrypt(encryptedKey) // AES-256-GCM 解密
  } catch {
    // 解密失败：可能是加密数据损坏或密钥不匹配
    return { success: false, latencyMs: 0, errorMessage: 'Key 解密失败' }
  }

  // -- 2. 记录开始时间（计算延迟用）--
  const start = Date.now() // 当前时间戳（毫秒）

  try {
    // -- 3. 发 GET 请求到厂商的 /models 接口 --
    // fetch 是 Node.js 18+ 内置的 HTTP 客户端（类似浏览器 fetch）
    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        // Bearer 认证：在请求头里带上 API Key
        Authorization: `Bearer ${apiKey}`,
      },
      // AbortSignal.timeout(10000) 设置 10 秒超时
      // 超过 10 秒没响应就自动中断，抛出 TimeoutError
      signal: AbortSignal.timeout(10000),
    })

    // -- 4. 计算延迟 --
    const latencyMs = Date.now() - start // 当前时间 - 开始时间 = 耗时

    // -- 5. 判断结果 --
    if (res.ok) {
      // HTTP 状态码 2xx → 成功
      return { success: true, latencyMs }
    }

    // HTTP 状态码非 2xx → 失败
    const body = await res.text()
    return {
      success: false,
      latencyMs,
      errorMessage: `HTTP ${res.status}: ${body.slice(0, 200)}`, // 截取前 200 字符
    }
  } catch (e: any) {
    // 网络错误或超时
    const latencyMs = Date.now() - start
    return {
      success: false,
      latencyMs,
      // e.name 是错误类型名称
      errorMessage:
        e.name === 'TimeoutError'
          ? '连接超时' // 超时
          : `网络错误:${e.message}`, // 其他网络错误
    }
  }
}

// ==================== streamChat ====================
// 流式对话：调用 AI 厂商 API，逐 token（逐字）推送回复
//
// 这是整个应用最重要的函数。它的工作方式：
//   1. 向厂商发 POST /chat/completions（stream: true）
//   2. 厂商开始逐 token 返回数据（SSE 格式：Server-Sent Events）
//   3. 每收到一个 token，调 onChunk(token) 回调
//   4. 全部收完，调 onDone(总Token数)
//   5. 出错，调 onError(错误信息)
//
// 什么是 SSE（Server-Sent Events）？
//   一种 HTTP 流式协议。响应不是一次性返回，而是持续推送。
//   每条数据格式：data: {"choices":[{"delta":{"content":"你"}}]}\n\n
//   流结束：data: [DONE]\n\n
//
// 什么是 ReadableStream？
//   浏览器/Node.js 的流式读取 API。
//   res.body.getReader() 返回一个 reader，可以逐块读取响应。
//   reader.read() 返回 { done: false, value: Uint8Array } 或 { done: true }
//
// 什么是 AbortController？
//   用于中途取消请求。controller.abort() 会中断 fetch 请求。
//   返回的 cancel 函数就是调 controller.abort()，用于用户点"停止生成"。
//
// @param baseUrl      — 厂商 API 地址
// @param encryptedKey — 加密的 API Key
// @param model        — 模型名，如 "deepseek-v4-pro"
// @param messages     — 对话历史 [{ role: 'user', content: '你好' }, ...]
// @param onChunk      — 每收到一个 token 时调用
// @param onDone       — 流正常结束时调用，参数是总 Token 数
// @param onError      — 出错时调用，参数是错误信息
// @returns cancel 函数，调它可以中止请求
export function streamChat(
  baseUrl: string,
  encryptedKey: string,
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onDone: (totalTokens: number) => void,
  onError: (error: string) => void,
): () => void {
  // -- 1. 解密 Key --
  let apiKey: string
  try {
    apiKey = decrypt(encryptedKey)
  } catch {
    // 解密失败 → 直接报错，返回空函数（没东西可取消）
    onError('Key 解密失败')
    return () => {} // 空函数，调了什么都不做
  }

  // -- 2. 创建 AbortController（用于中止请求）--
  const controller = new AbortController()

  // -- 3. 立即发出异步请求（不阻塞主线程）--
  // IIFE（立即执行异步函数表达式）：(async () => { ... })()
  // 作用是让异步逻辑在后台运行，不阻塞 streamChat 函数的返回
  ;(async () => {
    try {
      // -- 3a. 发 POST 请求到 /chat/completions --
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST', // POST 请求
        headers: {
          Authorization: `Bearer ${apiKey}`, // Bearer 认证
          'Content-Type': 'application/json', // 请求体是 JSON
        },
        body: JSON.stringify({
          model, // 模型名
          messages, // 对话历史
          stream: true, // 关键！开启流式返回
        }),
        signal: controller.signal, // 绑定 AbortController
      })

      // -- 3b. 检查响应状态 --
      if (!res.ok) {
        // HTTP 错误（401 Key无效 / 429 限流 / 500 服务器错误等）
        const body = await res.text() // 读取错误详情
        onError(`API 错误(${res.status}): ${body.slice(0, 300)}`)
        return // 提前返回，不继续处理流
      }

      // -- 3c. 获取 ReadableStream reader --
      // res.body 是 Response 的 body 流
      // .getReader() 获取 reader，可以逐块读取数据
      const reader = res.body!.getReader()

      // TextDecoder：把二进制 Uint8Array 解码成字符串
      const decoder = new TextDecoder()

      let totalTokens = 0 // 累计 Token 数（从流中解析）
      let buffer = '' // 缓冲区：存未完整接收的行

      // -- 3d. 循环读取流数据 --
      while (true) {
        // reader.read() 读取下一块数据
        // 返回 { done: boolean, value: Uint8Array }
        const { done, value } = await reader.read()

        // done=true 表示流结束了
        if (done) break

        // 把二进制数据解码成字符串，追加到缓冲区
        // decoder.decode(value, { stream: true })
        //   stream: true 告诉解码器"还有更多数据"（避免多字节字符被截断）
        buffer += decoder.decode(value, { stream: true })

        // 按换行符分割：SSE 每条消息以 \n\n 结束
        const lines = buffer.split('\n')

        // 最后一行可能不完整（只收到了半行），留到下次处理
        buffer = lines.pop() || ''

        // 处理每一行
        for (const line of lines) {
          const t = line.trim() // 去首尾空格

          // 跳过空行和非 data 行
          if (!t || !t.startsWith('data: ')) continue

          // 提取 data: 后面的 JSON 内容
          // t.slice(6) 跳过 "data: " 这 6 个字符
          const ds = t.slice(6)

          // 跳过 [DONE] 标记（OpenAI 格式的流结束信号）
          if (ds === '[DONE]') continue

          // 解析 JSON 提取 token 文本
          try {
            const d = JSON.parse(ds) // 把 JSON 字符串变成对象

            // d.choices?.[0]?.delta?.content 是 OpenAI 格式的 token 路径：
            //   choices = 回复选项数组
            //   [0] = 第一个（通常只有一个）
            //   delta = 增量内容（流式模式下用 delta 而非 message）
            //   content = 文本内容
            const delta = d.choices?.[0]?.delta

            // 如果有文本内容 → 调 onChunk 推送一个字
            if (delta?.content) {
              onChunk(delta.content)
            }

            // 如果有 Token 用量信息 → 更新总 Token 数
            // d.usage?.total_tokens 是本次请求的累计 Token 数
            if (d.usage?.total_tokens) {
              totalTokens = d.usage.total_tokens
            }
          } catch {
            // JSON 解析失败 → 跳过这一行（可能是格式不兼容的厂商返回）
          }
        }
      }

      // -- 3e. 流正常结束，调 onDone --
      onDone(totalTokens)
    } catch (e: any) {
      // AbortError 是用户主动取消（点停止生成），不是真正的错误
      if (e.name !== 'AbortError') {
        // 区分超时和网络错误
        onError(
          e.name === 'TimeoutError'
            ? '请求超时' // 网络超时
            : `网络错误:${e.message}`, // 其他网络错误
        )
      }
    }
  })()

  // -- 4. 返回 cancel 函数 --
  // 外部调用 cancel() → controller.abort() → fetch 中断 → 抛出 AbortError
  return () => controller.abort()
}

// ==================== summarizeChat ====================
// 非流式 AI 会话总结
//
// 工作原理：
//   1. 取会话的全部消息
//   2. 在消息前插入一条 system prompt，要求 AI 生成 200 字中文摘要
//   3. 调厂商 /chat/completions（stream: false），一次性返回结果
//   4. 返回 AI 生成的摘要文本
//
// 和 streamChat 的区别：
//   不流式（stream: false）→ 等全部生成完才返回
//   加了 system prompt → 让 AI 扮演"总结者"角色
//
// @param baseUrl      — 厂商 API 地址
// @param encryptedKey — 加密的 API Key
// @param model        — 模型名
// @param messages     — 会话全部消息
// @returns 摘要文本（200 字以内中文）
export async function summarizeChat(
  baseUrl: string,
  encryptedKey: string,
  model: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  // -- 1. 解密 Key --
  let apiKey: string
  try {
    apiKey = decrypt(encryptedKey)
  } catch {
    return '[错误] Key 解密失败'
  }

  // -- 2. 构造 system prompt --
  // system 角色的消息用于设定 AI 的行为
  // 这里让它做"摘要员"，输出 200 字以内的中文摘要
  const systemMsg = {
    role: 'system', // system 角色：给 AI 的行为指令
    content:
      '请用中文生成一段200字以内的会话摘要，概括这段对话的主要内容和结论。只输出摘要本身，不要加任何前缀或说明。',
  }

  try {
    // -- 3. 调厂商 API --
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [systemMsg, ...messages], // system prompt 放最前面
        stream: false, // 非流式：一次性返回完整回复
        max_tokens: 400, // 限制输出长度（200 字约等于 400 token）
      }),
      signal: AbortSignal.timeout(30000), // 30 秒超时
    })

    // -- 4. 处理失败响应 --
    if (!res.ok) {
      const body = await res.text()
      console.error('[summarizeChat] API 错误:', res.status, body.slice(0, 200))
      return '[错误] 摘要生成失败'
    }

    // -- 5. 解析响应 --
    const data = (await res.json()) as any

    // choices[0].message.content 是 AI 的回复文本
    // 非流式模式下用 message 而非 delta
    const summary = data.choices?.[0]?.message?.content || ''
    return summary.trim() // 去首尾空白
  } catch (e: any) {
    console.error('[summarizeChat] 异常:', e.message)
    // 区分超时和网络错误
    return e.name === 'TimeoutError'
      ? '[错误] 摘要请求超时'
      : '[错误] 摘要请求失败'
  }
}
