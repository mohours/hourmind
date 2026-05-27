// authHandler.ts —— 认证处理：setup / login / check
import { prisma } from '../db'
import { registerRoute } from '../wsRouter'
import type { WsResponse } from '../wsRouter'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

// 首次设置密码
registerRoute('auth.setup', async (payload): Promise<WsResponse> => {
  const { password } = payload
  if (!password || password.length < 4) return { success: false, error: { code: 'WEAK_PASSWORD', message: '密码至少4位' } }
  const existing = await prisma.appConfig.findUnique({ where: { key: 'password_hash' } })
  if (existing) return { success: false, error: { code: 'ALREADY_SETUP', message: '已设置过密码' } }
  const hash = await bcrypt.hash(password, 10)
  await prisma.appConfig.create({ data: { key: 'password_hash', value: hash } })
  const token = jwt.sign({ setup: true }, JWT_SECRET, { expiresIn: '24h' })
  return { success: true, data: { token, message: '密码设置成功' } }
})

// 登录
registerRoute('auth.login', async (payload): Promise<WsResponse> => {
  const { password } = payload
  const record = await prisma.appConfig.findUnique({ where: { key: 'password_hash' } })
  if (!record) return { success: false, error: { code: 'NOT_SETUP', message: '请先设置密码' } }
  const ok = await bcrypt.compare(password, record.value)
  if (!ok) return { success: false, error: { code: 'WRONG_PASSWORD', message: '密码错误' } }
  const token = jwt.sign({ userId: 'default' }, JWT_SECRET, { expiresIn: '24h' })
  return { success: true, data: { token, message: '登录成功' } }
})

// 验证 Token
registerRoute('auth.check', async (_p, token): Promise<WsResponse> => {
  if (!token) {
    const record = await prisma.appConfig.findUnique({ where: { key: 'password_hash' } })
    if (record) return { success: false, error: { code: 'TOKEN_REQUIRED', message: '请先登录' } }
    return { success: false, error: { code: 'NOT_SETUP', message: '请先设置密码' } }
  }
  try { jwt.verify(token, JWT_SECRET); return { success: true, data: { valid: true } } }
  catch { return { success: false, error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' } } }
})
