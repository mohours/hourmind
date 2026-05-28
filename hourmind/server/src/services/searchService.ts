// ============================================================
// searchService.ts —— 联网搜索服务
//
// 工作原理：
//   用户开启"联网搜索"开关后，发送消息时：
//     1. 把用户消息作为搜索关键词
//     2. 调用搜索引擎获取前几条结果的标题和摘要
//     3. 把搜索结果拼成文本，注入到 AI 对话上下文中
//     4. AI 就能基于实时信息回答问题
//
// 多引擎策略（自动降级）：
//   1. 先试 Bing（国内可用）
//   2. 失败则试 DuckDuckGo（国际线路）
//   3. 都失败 → 告知用户搜索不可用，对话继续
// ============================================================

// ==================== webSearch ====================
// 执行联网搜索，自动尝试多个引擎
// @param query  — 搜索关键词
// @param maxResults — 最多返回几条结果（默认 5）
// @returns { title, snippet, url }[] — 搜索结果
export async function webSearch(
  query: string,
  maxResults = 5,
): Promise<{ title: string; snippet: string; url: string }[]> {
  // 引擎 1：Bing（国内通常可用）
  try {
    const results = await searchBing(query, maxResults)
    if (results.length > 0) return results
  } catch (e: any) {
    console.log('[searchService] Bing 搜索失败:', e.message)
  }

  // 引擎 2：DuckDuckGo（国际线路）
  try {
    const results = await searchDuckDuckGo(query, maxResults)
    if (results.length > 0) return results
  } catch (e: any) {
    console.log('[searchService] DuckDuckGo 搜索失败:', e.message)
  }

  // 全部失败 → 返回空数组，对话正常进行
  console.log('[searchService] 所有搜索引擎均不可用')
  return []
}

// ==================== searchBing ====================
// 使用 Bing 搜索（国内可用，无需 API Key）
// 请求 https://www.bing.com/search?q=关键词
// 解析 HTML 提取标题和摘要
async function searchBing(
  query: string,
  maxResults: number,
): Promise<{ title: string; snippet: string; url: string }[]> {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-cn`

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    signal: AbortSignal.timeout(15000), // 15 秒超时
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const html = await response.text()
  const results: { title: string; snippet: string; url: string }[] = []

  // Bing 搜索结果格式：
  //   <li class="b_algo">
  //     <h2><a href="URL">标题</a></h2>
  //     <p>摘要</p>
  //   </li>
  //
  // 改用更简单的正则一次匹配一个结果块
  const blockRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi
  let blockMatch

  while ((blockMatch = blockRegex.exec(html)) !== null && results.length < maxResults) {
    const block = blockMatch[1]

    // 从块中提取标题和链接
    const linkMatch = /<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(block)
    if (!linkMatch) continue

    const url = linkMatch[1].replace(/&amp;/g, '&')
    // 标题里可能有 HTML 标签，去掉
    const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()

    // 跳过 Bing 内部链接
    if (url.includes('bing.com') || !title) continue

    // 从块中提取摘要
    const snippetMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block)
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]*>/g, '').trim().slice(0, 200)
      : ''

    results.push({ title, snippet, url })
  }

  console.log(`[searchService] Bing 返回 ${results.length} 条结果`)
  return results
}

// ==================== searchDuckDuckGo ====================
// 使用 DuckDuckGo Lite 搜索（备选方案）
async function searchDuckDuckGo(
  query: string,
  maxResults: number,
): Promise<{ title: string; snippet: string; url: string }[]> {
  const searchUrl = `https://lite.duckduckgo.com/lite?q=${encodeURIComponent(query)}`

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const html = await response.text()
  const results: { title: string; snippet: string; url: string }[] = []

  // 用正则提取链接和摘要
  const linkRegex =
    /<a[^>]*?class="result-link"[^>]*?href="([^"]*)"[^>]*?>([^<]*)<\/a>/gi
  const snippetRegex =
    /<span[^>]*?class="result-snippet"[^>]*?>([^<]*)<\/span>/gi

  const links: { url: string; title: string }[] = []
  let m
  while ((m = linkRegex.exec(html)) !== null) {
    const url = m[1].replace(/&amp;/g, '&')
    const title = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    if (!url.includes('duckduckgo.com')) {
      links.push({ url, title })
    }
  }

  const snippets: string[] = []
  while ((m = snippetRegex.exec(html)) !== null) {
    snippets.push(m[1].trim())
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      snippet: snippets[i]?.slice(0, 200) || '',
      url: links[i].url,
    })
  }

  console.log(`[searchService] DuckDuckGo 返回 ${results.length} 条结果`)
  return results
}

// ==================== formatSearchResults ====================
// 把搜索结果数组转成纯文本，用于注入 AI 对话上下文
//
// 格式示例：
//   [网络搜索结果]
//   1. DeepSeek发布V4 Pro模型 - 深度求索公司发布新一代...
//      https://example.com/deepseek-v4
//   2. 人工智能发展趋势 - 2026年AI行业十大趋势...
//      https://example.com/ai-trends
export function formatSearchResults(
  results: { title: string; snippet: string; url: string }[],
): string {
  if (results.length === 0) return ''

  const lines: string[] = ['[网络搜索结果]', '']

  results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}`)
    if (r.snippet) lines.push(`   ${r.snippet}`)
    lines.push(`   ${r.url}`)
    lines.push('')
  })

  return lines.join('\n')
}
