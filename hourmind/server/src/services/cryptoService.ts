// ============================================================
// cryptoService.ts —— AES-256-GCM 加密解密服务
// 作用：把用户的 API Key 加密后存数据库，防止泄密
//
// AES-256-GCM 是什么？
//   AES = 美国国家标准加密算法，全球最广泛使用的对称加密
//   256 = 密钥长度 256 位（需要正好 32 字节的密钥）
//   GCM = 一种加密模式，同时提供加密和防篡改验证
//
// 加密后的数据格式（存到数据库）：
//   IV（16字节hex）:认证标签（16字节hex）:密文
// ============================================================

// Node.js 内置的加密模块，不需要额外安装
import crypto from 'crypto'

// ==================== 密钥配置 ====================

// 加密密钥必须恰好 32 字节（256 位）
// 优先从环境变量 .env 文件读取，读不到就用备用密钥
// Buffer.from() 把文字字符串转成二进制数据（字节数组）
const KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || 'abcdefghijklmnopqrstuvwxyz123456',
  'utf8',  // utf8 表示按 UTF-8 编码解析（英文=1字节/字）
)

// ==================== 加密函数 ====================

/**
 * 加密明文 API Key
 *
 * @param plainText - 用户输入的 API Key 原文，如 "sk-abc123..."
 * @returns  { encrypted, suffix }
 *   encrypted = 加密后的密文（格式：iv:authTag:ciphertext，全十六进制）
 *   suffix = 明文最后 6 个字符（用于列表展示识别）
 */
export function encrypt(plainText: string): { encrypted: string; suffix: string } {
  // 1. 生成随机"初始向量"（Initialization Vector, IV）
  //    IV 的作用：让每次加密同一个 Key 的结果都不同
  //    16 字节 = 128 位（AES-GCM 标准 IV 长度）
  const iv = crypto.randomBytes(16)

  // 2. 创建加密器
  //    crypto.createCipheriv("算法名", "密钥", "初始向量")
  //    返回一个 Cipher 对象，可以往里写数据然后读加密结果
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)

  // 3. 写入明文数据并读取密文
  //    cipher.update(数据, "输入编码", "输出编码") → 返回部分加密结果
  //    'utf8' = 输入是普通文本，'hex' = 输出是十六进制字符串
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  //    cipher.final() → 返回最后一块加密结果（收尾）
  encrypted += cipher.final('hex')

  // 4. 获取"认证标签"（Authentication Tag）
  //    用于解密时验证数据是否被篡改过
  const authTag = cipher.getAuthTag()

  // 5. 把 IV + 认证标签 + 密文拼成一个字符串
  //    用冒号分隔三个部分
  //    iv.toString('hex')  → 把 16 字节 IV 转成 32 个十六进制字符
  //    authTag.toString('hex') 同理
  const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted

  // 6. 返回加密结果
  //    suffix 是明文最后 6 位，用于前端的列表展示（如 "sk-abc"）
  //    .slice(-6) 取最后 6 个字符，负数表示从末尾倒数
  return { encrypted: combined, suffix: plainText.slice(-6) }
}

// ==================== 解密函数 ====================

/**
 * 解密密文，还原明文 API Key
 *
 * @param combined - 加密时生成的完整密文（格式：iv:authTag:ciphertext）
 * @returns 明文的 API Key
 * @throws 如果数据格式错误或被篡改，会抛出异常
 */
export function decrypt(combined: string): string {
  // 1. 按冒号分割三部分
  //    String.split(':') 把字符串按冒号切成数组
  const parts = combined.split(':')

  // 2. 验证数据完整性：必须是恰好 3 部分
  if (parts.length !== 3) {
    throw new Error('加密数据格式错误')
  }

  // 3. 数组解构：把 3 个元素分别赋值给 3 个变量
  //    parts[0] → ivHex（十六进制 IV）
  //    parts[1] → authTagHex （十六进制认证标签）
  //    parts[2] → encryptedHex （十六进制密文）
  const [ivHex, authTagHex, encryptedHex] = parts

  // 4. 把十六进制字符串还原成二进制 Buffer
  //    Buffer.from("abc123", "hex") → 把十六进制字符串解析为字节
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  // 5. 创建解密器
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  //    设置认证标签（解密时会验证数据是否被篡改）
  decipher.setAuthTag(authTag)

  // 6. 解密数据
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  // 7. 返回明文
  return decrypted
}
