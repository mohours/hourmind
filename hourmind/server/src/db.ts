// ============================================================
// db.ts —— 数据库连接（Prisma Client 单例模式）
//
// 什么是 Prisma Client？
//   Prisma 是一个 TypeScript ORM（对象关系映射）工具。
//   它根据 schema.prisma 自动生成类型安全的数据库操作函数。
//   PrismaClient 是连接数据库的核心对象，所有查询都通过它。
//
// 什么是单例模式？
//   整个应用只创建一个 PrismaClient 实例，所有人共用。
//   为什么不每次新建？每次都 new PrismaClient() 会创建新的
//   数据库连接池，浪费资源，而且开发时热重载会导致连接泄漏。
//
// 什么是 globalThis？
//   Node.js 中的全局对象（类似浏览器的 window）。
//   把 PrismaClient 挂在 globalThis 上可以确保模块重新加载时
//   （比如 tsx watch 热重载）复用同一个实例。
// ============================================================

// 从 @prisma/client 包导入 PrismaClient 类
import { PrismaClient } from '@prisma/client'

// globalThis 是 Node.js 的全局作用域对象
// as unknown as 是 TypeScript 双重类型断言（先转 unknown 再转目标类型）
// 因为我们给 globalThis 扩展了一个 prisma 属性，需要告诉 TS 这个属性的类型
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined // 可能还没创建，所以可以是 undefined
}

// 如果 globalThis 上已经有 prisma 实例 → 复用
// 如果没有 → new 一个 PrismaClient()
// ?? 是"空值合并运算符"：左边是 null/undefined 时取右边
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

// 开发环境下，把实例挂到 globalThis 上
// 这样 tsx watch 热重载时，不会创建重复的连接
// NODE_ENV 是 Node.js 的环境变量，'production' 表示生产环境
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
