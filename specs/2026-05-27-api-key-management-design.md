# HourMind — API Key 管理模块 技术设计规格

**日期**：2026-05-27
**版本**：v2.0（纯 SQLite + Node.js 方案）
**范围**：Phase 1（CRUD + 测试 + 统计）+ Phase 2（路由规则 + 审计日志）

---

## 1. 架构决策总结

| 决策点 | 选择 |
|--------|------|
| 加密方案 | Node.js AES-256-GCM 本地加密（cryptoService.ts），密钥来自环境变量 `ENCRYPTION_KEY` |
| 厂商维护 | 数据库存储，Prisma seed 预置 7 家厂商 |
| Key 存储 | 加密密文存 `api_keys.encryptedKey`，前端永远只拿到 `keySuffix`（后 6 位） |
| Key 调用 | Node.js 直接解密后调厂商 API，无中间服务 |
| 前端通信 | 统一 WebSocket 协议 |
| Key 测试 | GET 厂商 /models 接口，验证连通性 + 记录延迟 |
| 用量统计 | 被动记录（流式对话结束后写入 token_usage_records） |
| 模型路由 | Phase 2 实现 |

---

## 2. 数据模型（SQLite）

### 2.1 `AiProvider` — AI 厂商

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| name | String | 显示名称 |
| slug | String @unique | 唯一标识 |
| baseUrl | String | API 基础地址 |
| logoUrl | String? | Logo 图标 |
| isActive | Boolean | 启用/禁用 |
| createdAt | DateTime | |

### 2.2 `ApiKey` — API Key

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| providerId | String | FK → AiProvider |
| alias | String | 用户自定义别名 |
| encryptedKey | String | AES-256-GCM 加密后的 Key |
| keySuffix | String | Key 最后 6 位明文（列表识别用） |
| tags | String | JSON 字符串（标签数组） |
| status | String | `active` / `disabled` / `error` |
| isDeleted | Boolean | 软删除标记 |
| deletedAt | DateTime? | 软删除时间 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 2.3 `KeyTestLog` — Key 测试记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| keyId | String | FK → ApiKey |
| isSuccess | Boolean | 测试是否通过 |
| latencyMs | Int | 响应延迟（毫秒） |
| errorMessage | String? | 失败原因 |
| testedAt | DateTime | |

### 2.4 `TokenUsageRecord` — Token 用量记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| keyId | String | FK → ApiKey |
| modelName | String | 调用的模型名 |
| promptTokens | Int | |
| completionTokens | Int | |
| estimatedCostCents | Int | 预估费用（分） |
| recordedAt | DateTime | |
| sessionId | String? | 关联的会话 ID |

---

## 3. API 接口（已实现）

| action | 说明 | payload |
|--------|------|---------|
| `providers.list` | 获取厂商列表 | — |
| `keys.list` | 获取 Key 列表 | `search?`, `status?` |
| `keys.stats` | 获取统计数据 | — |
| `keys.create` | 添加 Key | `providerId`, `keyValue`, `alias?`, `tags?` |
| `keys.test` | 测试连通性 | `keyId` |
| `keys.delete` | 软删除 | `keyId` |
| `keys.toggle` | 启用/禁用 | `keyId`, `enabled` |

### keys.stats 响应

```json
{
  "total": 5,
  "active": 3,
  "monthlyCost": 1200
}
```

---

## 4. 前端路由与组件树（当前实现）

### 路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/keys` | KeysView | Key 列表页 |

### 组件树

```
views/
  └── KeysView.vue             # 页面容器（统计卡片 + 搜索筛选 + Key 列表）

components/
  ├── KeyCard.vue              # 单张 Key 卡片（别名/后缀/状态/操作按钮）
  └── AddKeyDialog.vue         # 添加 Key 弹窗（选厂商 + 填 Key + 别名）
```

---

## 5. 状态管理（keyStore）

```typescript
// stores/keyStore.ts — 当前已实现

interface KeyStoreState {
  keys: ApiKey[]
  loading: boolean
  search: string
  statusFilter: string
  stats: { total: number; active: number; monthlyCost: number }
  showAddDialog: boolean
  providers: Provider[]
}

// Getters
//   filteredKeys — 根据 search + statusFilter 过滤

// Actions
//   fetchKeys() / fetchStats() / fetchProviders()
//   createKey(data) / testKey(id) / deleteKey(id) / toggleKey(id, enabled)
```

---

## 6. 加密方案

- 算法：AES-256-GCM
- 密钥：环境变量 `ENCRYPTION_KEY`（32 字节 hex）
- 实现：`cryptoService.ts`
  - `encrypt(plainText: string)` → `{ encrypted: string; suffix: string }`
  - `decrypt(encrypted: string)` → `string`
- 流程：前端传明文 Key → Node.js 加密后存 SQLite → 调用厂商 API 时解密 → 前端永远只拿到 `keySuffix`

---

## 7. 错误码

| code | 含义 |
|------|------|
| `KEY_NOT_FOUND` | Key 不存在或已删除 |
| `PROVIDER_NOT_FOUND` | 厂商不存在 |
| `MISSING_FIELDS` | 厂商和 Key 不能为空 |
| `INTERNAL_ERROR` | 加密或其他内部错误 |

---

## 8. Phase 2 扩展（规划中）

- 路由规则引擎（`RoutingRule` 表，按任务类型/复杂度自动选模型）
- 操作审计日志（`KeyOperationLog` 表）
- Key 恢复（30 天回收站）
- 用量趋势图表
