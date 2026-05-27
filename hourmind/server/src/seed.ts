// seed.ts —— 预置 AI 厂商数据
// 执行：npm run db:seed
import { prisma } from './db'

const providers = [
  { name: 'OpenAI',          slug: 'openai',    baseUrl: 'https://api.openai.com/v1' },
  { name: 'Anthropic',       slug: 'anthropic',  baseUrl: 'https://api.anthropic.com' },
  { name: 'DeepSeek',        slug: 'deepseek',   baseUrl: 'https://api.deepseek.com/v1' },
  { name: 'Google Gemini',   slug: 'gemini',     baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { name: 'xAI Grok',        slug: 'grok',       baseUrl: 'https://api.x.ai/v1' },
  { name: 'Moonshot',        slug: 'moonshot',   baseUrl: 'https://api.moonshot.cn/v1' },
  { name: '通义千问',         slug: 'qwen',       baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
]

async function main() {
  console.log('🌱 插入厂商数据...')
  for (const p of providers) {
    await prisma.aiProvider.upsert({ where: { slug: p.slug }, create: p, update: {} })
    console.log(`  ✅ ${p.name}`)
  }
  console.log(`🎉 完成，共 ${providers.length} 家厂商`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
