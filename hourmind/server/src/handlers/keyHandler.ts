// ============================================================
// keyHandler.ts —— API Key 管理的处理函数
// 负责 keys.* 和 providers.* 系列 action
// 每个 action 都通过 registerRoute() 注册到 wsRouter
//
// action 清单：
//   providers.list   — 获取 AI 厂商列表
//   keys.list        — 获取 Key 列表
//   keys.stats       — 获取统计数据
//   keys.create      — 添加新 Key
//   keys.test        — 测试 Key 连通性
//   keys.delete      — 删除 Key（软删除）
//   keys.toggle      — 启用/禁用 Key
// ============================================================

// 数据库连接（Prisma Client）
import { prisma } from '../db'
// 路由注册函数
import { registerRoute } from '../wsRouter'
// 响应类型定义
import type { WsResponse } from '../wsRouter'
// AES 加密函数
import { encrypt } from '../services/cryptoService'
// AI 厂商 API 连通测试函数
import { testKeyConnection } from '../services/aiService'

// ==================== providers.list ====================
// 获取所有启用的 AI 厂商列表
// 前端添加 Key 时需要选厂商，这就是那个下拉选项的数据来源
registerRoute('providers.list', async (): Promise<WsResponse> => {
  // Prisma 查 ai_providers 表
  // where: { isActive: true }  只查启用的厂商
  // orderBy: { name: 'asc' }   按名称 A→Z 排序
  const providers = await prisma.aiProvider.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })

  return { success: true, data: providers }
})

// ==================== keys.list ====================
// 获取用户添加的所有 API Key 列表
// payload: { search?, status? }  — 可选的搜索和筛选条件
registerRoute('keys.list', async (payload): Promise<WsResponse> => {
  const { search, status } = payload || {}

  // 构建数据库查询条件
  // isDeleted: false  — 排除已删除的 Key（软删除）
  const where: any = { isDeleted: false }
  // 如果用户选择了特定状态筛选，加上条件
  if (status && status !== 'all') {
    where.status = status
  }

  // 查 api_keys 表，同时把关联的厂商信息也查出来
  // include: { provider: true }  — 联表查询，key 的 provider 字段会有厂商完整信息
  // orderBy: { createdAt: 'desc' } — 最近创建的排最上面
  let keys = await prisma.apiKey.findMany({
    where,
    include: { provider: true },
    orderBy: { createdAt: 'desc' },
  })

  // 去掉 encryptedKey 字段（绝不在前端暴露加密后的 Key）
  let result = keys.map((k: any) => ({
    ...k,
    encryptedKey: undefined,
  }))

  // 如果用户输入了搜索词，在前端做文本过滤
  // （简单实现：别名或厂商名包含搜索词的都留下）
  if (search) {
    const kw = search.toLowerCase()  // 转小写做大小写不敏感匹配
    result = result.filter((k: any) =>
      k.alias.toLowerCase().includes(kw) ||
      k.provider.name.toLowerCase().includes(kw)
    )
  }

  return { success: true, data: result }
})

// ==================== keys.stats ====================
// 获取 Key 的统计数据（顶部三个统计卡片用的）
// 返回：总数、活跃数、本月 Token 消耗金额
registerRoute('keys.stats', async (): Promise<WsResponse> => {
  // 统计未删除的 Key 总数
  const total = await prisma.apiKey.count({
    where: { isDeleted: false },
  })

  // 统计活跃的 Key 数
  const active = await prisma.apiKey.count({
    where: { isDeleted: false, status: 'active' },
  })

  // 计算本月 Token 消耗总额
  const now = new Date()
  // new Date(年, 月, 日)  — 注意月份从 0 开始（0=1月）
  // getFullYear() 返回四位年份，getMonth() 返回 0-11 的月份
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  // gte = greater than or equal（大于等于）
  const records = await prisma.tokenUsageRecord.findMany({
    where: { recordedAt: { gte: startOfMonth } },
  })
  // .reduce() 遍历数组累加：从 0 开始，每个记录加上 estimatedCostCents
  const monthlyCost = records.reduce(
    (sum, r) => sum + r.estimatedCostCents,
    0,  // 初始值是 0
  )

  return { success: true, data: { total, active, monthlyCost } }
})

// ==================== keys.create ====================
// 添加一个新的 API Key
// payload: { providerId, keyValue, alias?, tags? }
//
// 流程：
//   1. 校验必填字段
//   2. 确认厂商存在
//   3. AES-256 加密 Key
//   4. 写入数据库
//   5. 返回成功（不含 encryptedKey）
registerRoute('keys.create', async (payload): Promise<WsResponse> => {
  // 整个逻辑包在 try-catch 里
  // 这样即使加密或其他操作出错，也能返回友好错误信息给前端
  try {
    const { providerId, keyValue, alias, tags } = payload

    // --- 1. 校验必填字段 ---
    if (!providerId || !keyValue) {
      return {
        success: false,
        error: { code: 'MISSING_FIELDS', message: '厂商和Key不能为空' },
      }
    }

    // --- 2. 验证厂商存在 ---
    // Prisma findUnique 用主键查单条记录
    const provider = await prisma.aiProvider.findUnique({
      where: { id: providerId },
    })
    if (!provider) {
      return {
        success: false,
        error: { code: 'PROVIDER_NOT_FOUND', message: '厂商不存在' },
      }
    }

    // --- 3. 加密 Key ---
    // encrypt() 返回 { encrypted: "密文", suffix: "后6位" }
    const { encrypted, suffix } = encrypt(keyValue)

    // --- 4. 存入数据库 ---
    // Prisma create 新增一条记录
    // data 里指定每个字段的值：
    //   encryptedKey = 加密后的密文
    //   keySuffix = 后 6 位（列表展示用）
    //   alias = 别名，没填就用"厂商名 Key"
    //   tags = 标签数组，转成 JSON 字符串存储（SQLite 不支持数组）
    // include: { provider: true } 返回时带上厂商信息
    const apiKey = await prisma.apiKey.create({
      data: {
        providerId,
        encryptedKey: encrypted,
        keySuffix: suffix,
        alias: alias || `${provider.name} Key`,
        tags: JSON.stringify(tags || []),
      },
      include: { provider: true },
    })

    // --- 5. 返回成功 ---
    // { ...apiKey, encryptedKey: undefined } 展开对象并删除 encryptedKey 字段
    // 前端永远看不到加密后的 Key
    return { success: true, data: { ...apiKey, encryptedKey: undefined } }
  } catch (e: any) {
    // 出错时返回 INTERNAL_ERROR，并把具体错误信息附上
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: e.message || '添加失败',
      },
    }
  }
})

// ==================== keys.test ====================
// 测试一个 Key 的连通性
// payload: { keyId }
//
// 流程：
//   1. 查出 Key + 厂商信息
//   2. 调 aiService.testKeyConnection() 发请求给厂商 API
//   3. 记录测试日志到 key_test_logs 表
//   4. 根据结果更新 Key 的状态
registerRoute('keys.test', async (payload): Promise<WsResponse> => {
  const { keyId } = payload

  // --- 1. 查出 Key 和关联的厂商 ---
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
    include: { provider: true },
  })
  if (!apiKey) {
    return {
      success: false,
      error: { code: 'KEY_NOT_FOUND', message: 'Key 未找到' },
    }
  }

  // --- 2. 调厂商 API 做连通测试 ---
  // testKeyConnection 内部会：
  //   解密 Key → 发 GET 请求到厂商 /models 接口
  //   返回 { success, latencyMs, errorMessage }
  const result = await testKeyConnection(
    apiKey.provider.baseUrl,
    apiKey.encryptedKey,
  )

  // --- 3. 记录测试日志 ---
  await prisma.keyTestLog.create({
    data: {
      keyId,
      isSuccess: result.success,
      latencyMs: result.latencyMs,
      errorMessage: result.errorMessage,
    },
  })

  // --- 4. 根据测试结果更新 Key 状态 ---
  // 成功 → active，失败 → error
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { status: result.success ? 'active' : 'error' },
  })

  return { success: true, data: result }
})

// ==================== keys.delete ====================
// 删除 Key（软删除：标记为已删除，数据还留着）
// payload: { keyId }
registerRoute('keys.delete', async (payload): Promise<WsResponse> => {
  // 软删除：只改状态字段，不真正删数据
  // isDeleted = true  → 后续查询会排除这条记录
  // deletedAt = new Date()  → 记录删除时间（30天内可恢复）
  // status = 'disabled'  → 同时禁用 Key
  await prisma.apiKey.update({
    where: { id: payload.keyId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      status: 'disabled',
    },
  })

  return { success: true, data: { message: '已删除' } }
})

// ==================== keys.toggle ====================
// 启用/禁用 Key（切换开关）
// payload: { keyId, enabled }
registerRoute('keys.toggle', async (payload): Promise<WsResponse> => {
  const { keyId, enabled } = payload

  // enabled ? 'active' : 'disabled'
  // 这是三元运算符：条件为真返回冒号前面，为假返回后面
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { status: enabled ? 'active' : 'disabled' },
  })

  return {
    success: true,
    data: { status: enabled ? 'active' : 'disabled' },
  }
})
