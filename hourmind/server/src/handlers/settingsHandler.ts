// ============================================================
// settingsHandler.ts —— 系统设置处理函数
// 负责 settings.get / settings.update
// 数据存储在 AppConfig 表（key-value 结构）
//
// 当前管理的设置项：
//   default_model   — 默认 AI 模型
//   temperature     — 模型温度参数（0~1）
//   particle_bg     — 粒子背景开关（true/false）
//   glow_intensity  — 辉光强度（low/medium/high）
// ============================================================

// 数据库连接
import { prisma } from '../db'
// 路由注册
import { registerRoute } from '../wsRouter'
import type { WsResponse } from '../wsRouter'

// 默认设置值
const DEFAULTS: Record<string, string> = {
  default_model: 'deepseek-v4-pro', // 默认模型
  temperature: '0.7', // 温度参数
  particle_bg: 'true', // 粒子背景
  glow_intensity: 'medium', // 辉光强度
}

// 允许的设置键（防止用户写入任意 key）
const ALLOWED_KEYS = new Set(Object.keys(DEFAULTS))

// ==================== settings.get ====================
// 获取所有系统设置（排除密码哈希等敏感配置）
registerRoute('settings.get', async (): Promise<WsResponse> => {
  try {
    // 从 AppConfig 表读取所有设置的当前值
    const records = await prisma.appConfig.findMany({
      where: {
        key: { in: Array.from(ALLOWED_KEYS) }, // 只查允许的设置项
      },
    })

    // 把数据库记录转成 { key: value } 对象
    const dbSettings: Record<string, string> = {}
    for (const r of records) {
      dbSettings[r.key] = r.value // key 是 AppConfig 的主键，value 是设置值
    }

    // 合并默认值：数据库有的用数据库值，没有的用默认值
    const settings: Record<string, string> = {}
    for (const key of ALLOWED_KEYS) {
      // dbSettings[key] 有值就用，否则用 DEFAULTS[key]
      settings[key] = dbSettings[key] || DEFAULTS[key]
    }

    return { success: true, data: settings }
  } catch (e: any) {
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: e.message || '获取设置失败' },
    }
  }
})

// ==================== settings.update ====================
// 批量更新系统设置
// payload: { default_model?, temperature?, particle_bg?, glow_intensity? }
registerRoute('settings.update', async (payload): Promise<WsResponse> => {
  try {
    if (!payload || Object.keys(payload).length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_PARAMS', message: '请提供要更新的设置项' },
      }
    }

    // 遍历 payload 中的每个字段
    for (const [key, value] of Object.entries(payload)) {
      // 安全检查：只允许更新白名单中的设置键
      if (!ALLOWED_KEYS.has(key)) continue // 跳过不允许的 key

      // 校验值类型
      const strValue = String(value) // 统一转字符串存储

      // upsert = update or insert：存在则更新，不存在则插入
      // create: { key, value } — 新增时写入
      // update: { value } — 已存在时只更新值
      await prisma.appConfig.upsert({
        where: { key }, // 按主键查找
        create: { key, value: strValue }, // 插入新记录
        update: { value: strValue }, // 更新已有记录
      })
    }

    return { success: true, data: { message: '设置已保存' } }
  } catch (e: any) {
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: e.message || '保存设置失败' },
    }
  }
})
