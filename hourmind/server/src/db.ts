// db.ts —— 数据库连接（Prisma Client 单例）
// 全局只保留一个 PrismaClient 实例，避免开发热重载时创建多余的连接
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
