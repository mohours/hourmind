# HourMind — 智能对话模块 技术设计规格

**日期**：2026-05-27
**版本**：v2.0（纯 SQLite + Node.js 方案）
**范围**：Phase 1（基础对话 + 流式输出 + 多模型切换 + 会话管理 + Markdown 渲染）+ Phase 2（全局记忆 + 右侧辅助面板 + 文件上传）

---

## 1. 架构决策总结

| 决策点 | 选择 |
|--------|------|
| 流式输出通道 | Node.js 直接调厂商 API（aiService.ts），通过 ctx.push() 推前端 |
| 模型调用 | Node.js 根据用户选择的模型 + 第一个可用 API Key 直接调厂商 |
| Key 选择 | 取第一个 status=active 的 Key，后续可扩展模型→厂商映射 |
| 上下文管理 | 取最近 40 条消息历史作为上下文 |
| Markdown 渲染 | 前端使用 marked + highlight.js |
| 全局记忆 | Phase 2 实现，SQLite 存储（无向量，使用关键词匹配） |

---

## 2. 数据模型

### 2.1 `Conversation` — 会话

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| title | String | 会话标题（第一条消息前 30 字自动命名） |
| model | String | 当前使用的模型 |
| status | String | `active` / `archived` |
| isPinned | Boolean | 置顶 |
| isStarred | Boolean | 星标 |
| totalTokens | Int | 会话累计 Token |
| messageCount | Int | 消息总数 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 2.2 `Message` — 消息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| conversationId | String | FK → Conversation |
| role | String | `user` / `assistant` |
| content | String | 消息内容（Markdown） |
| model | String? | 此条回复使用的模型（仅 assistant） |
| tokenCount | Int? | Token 消耗 |
| metadata | String | 扩展字段 JSON（默认 "{}"） |
| createdAt | DateTime | |

---

## 3. API 接口合约

### 3.1 通用帧格式（WebSocket）

**请求：**
```json
{ "id": "req_001", "type": "request", "action": "conversations.list", "payload": {} }
```

**响应：**
```json
{ "id": "req_001", "type": "response", "success": true, "data": {} }
```

**推送帧（流式对话）：**
```json
{ "type": "stream_chunk", "message_id": "yyy", "chunk": "你好" }
{ "type": "stream_end", "message_id": "yyy", "token_count": 524, "model": "deepseek-v4-pro" }
{ "type": "stream_error", "message_id": "yyy", "error": { "code": "STREAM_ERROR", "message": "..." } }
```

### 3.2 会话管理（已实现）

| action | 说明 | payload |
|--------|------|---------|
| `conversations.list` | 会话列表 | — |
| `conversations.create` | 新建会话 | `title?`, `model?` |
| `conversations.update` | 更新会话 | `conversationId`, `title?`, `model?` |
| `conversations.delete` | 软删除（status=archived） | `conversationId` |

### 3.3 消息操作（已实现）

| action | 说明 | payload |
|--------|------|---------|
| `messages.list` | 获取消息历史 | `conversationId` |
| `messages.send` | 发送消息（流式） | `conversationId`, `content`, `model?` |
| `messages.regenerate` | 重新生成最后回复 | `conversationId` |

### 3.4 流式消息 — 完整流程

```
前端                      Node.js                          厂商 API
 │                          │                                │
 ├─messages.send───────────▶│                                │
 │                          ├─验证会话 + 查可用 Key              │
 │                          ├─保存用户消息 + 创建 AI 占位         │
 │                          ├─返回 { mode: 'stream', ... }    │
 │◀──{ mode: 'stream' }────┤                                │
 │                          ├─异步调 streamChat()              │
 │                          │  ───POST /chat/completions─────▶│
 │◀──stream_chunk ─────────┤◀───data: {"choices":[{"delta":..}]}─┤
 │◀──stream_chunk ─────────┤                                │
 │◀──stream_end ───────────┤                                │
 │                          ├─更新消息内容 + Token 数           │
```

### 3.5 Phase 2 扩展

| action | 说明 |
|--------|------|
| `memories.list` | 全局记忆列表 |
| `memories.create` | 添加记忆 |
| `memories.delete` | 删除记忆 |

---

## 4. 前端路由与组件树（当前实现）

### 路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/chat` | ChatView | 左侧会话列表 + 中间聊天区 |

### 组件树

```
views/
  └── ChatView.vue                        # 对话页面容器

components/
  ├── ConversationList.vue                # 左侧会话列表
  ├── ChatMessageList.vue                 # 消息列表容器
  └── ChatMessage.vue                     # 单条消息（Markdown + 代码高亮）
```

---

## 5. 状态管理（chatStore）

```typescript
// stores/chatStore.ts — 当前已实现

interface ChatStoreState {
  conversations: Conversation[]       // 会话列表
  activeId: string | null             // 当前活跃会话 ID
  messages: Message[]                 // 当前会话的消息
  loading: boolean                    // 加载中
  isStreaming: boolean               // 流式输出中
  currentModel: string               // 当前选择的模型
}

// Actions
//   fetchConversations() / createConversation()
//   selectConversation(id) / deleteConversation(id)
//   sendMessage(content) / regenerateLast()
```

---

## 6. 错误处理

| code | 含义 | 前端处理 |
|------|------|---------|
| `CONVERSATION_NOT_FOUND` | 会话不存在 | 回退到空状态 |
| `NO_ACTIVE_KEY` | 没有可用的 API Key | 提示 + 跳转 `/keys` |
| `STREAM_ERROR` | 流式输出失败 | 显示错误信息 + 保留已有内容 |
| `NO_USER_MESSAGE` | 没有可重新生成的消息 | 提示无法操作 |

---

## 7. Phase 2 扩展（规划中）

- 全局记忆管理（SQLite 存储 + 关键词匹配）
- 文件/图片上传
- 右侧辅助面板
- 消息编辑/点赞点踩
- 会话标签系统
