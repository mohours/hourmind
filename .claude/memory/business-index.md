---
name: 业务功能索引
description: 记录项目业务功能的出生到死亡——功能描述、设计文档、代码位置、变更历史
type: project
created_at: 2026-06-02 10:15
updated_at: 2026-06-02 12:00
---

## 0. 项目骨架
- **功能**：FastAPI 后端（port 8000）+ Vue 3 前端（port 5173），sqlite3 数据库 7 张表，7 家 AI 厂商种子数据，Vue Router + Pinia + Quantum Glass 样式系统
- **状态**：已实现
- **设计文档**：docs/superpowers/plans/2026-06-01-phase-1-scaffolding.md
- **代码**：server/main.py, server/database.py, server/db/, client/src/
- **变更记录**：

## 1. 认证系统
- **功能**：本地密码设置/登录，JWT 令牌签发与验证，前后端路由保护
- **状态**：已实现
- **设计文档**：docs/superpowers/plans/2026-06-01-phase-2-auth.md
- **代码**：server/auth.py, server/models.py, server/routes/auth.py, client/src/stores/appStore.ts, client/src/api/index.ts, client/src/views/SetupView.vue, client/src/views/LoginView.vue, client/src/App.vue
- **变更记录**：

## 2. API Key 管理
- **功能**：多厂商 AI API Key 统一管理，AES-256-GCM 加密存储，连接测试，前端 KeysView 玻璃卡片列表 + 添加弹窗
- **状态**：已实现
- **设计文档**：docs/superpowers/plans/2026-06-01-phase-3-keys.md
- **代码**：server/routes/keys.py, server/services/crypto_service.py, client/src/stores/keyStore.ts, client/src/views/KeysView.vue
- **变更记录**：

## 3. 智能对话
- **功能**：流式 SSE 聊天（WebSocket），会话管理 CRUD，Markdown 渲染，消息历史，取消生成
- **状态**：已实现
- **设计文档**：docs/superpowers/plans/2026-06-01-phase-4-chat.md
- **代码**：server/services/ai_service.py, server/routes/conversations.py, server/routes/chat_ws.py, client/src/stores/chatStore.ts, client/src/views/ChatView.vue
- **变更记录**：

## 4. 仪表盘 + 对话历史
- **功能**：首页数据概览（token 用量、Key 数、对话数），最近对话列表，快捷入口导航，历史记录页面
- **状态**：已实现
- **设计文档**：docs/superpowers/plans/2026-06-01-phase-5-dashboard-history.md
- **代码**：server/routes/dashboard.py, client/src/views/DashboardView.vue, client/src/views/HistoryView.vue
- **变更记录**：

## 5. 待办事项
- **功能**：任务 CRUD，嵌套子任务，状态筛选标签，优先级标签，创建/编辑弹窗
- **状态**：已实现
- **设计文档**：docs/superpowers/plans/2026-06-01-phase-6-tasks.md
- **代码**：server/routes/tasks.py, client/src/stores/taskStore.ts, client/src/views/TasksView.vue
- **变更记录**：

## 6. 知识库
- **功能**：知识卡片 CRUD，类型筛选（笔记/参考/片段/想法），全文搜索，2 列玻璃卡片网格，详情弹窗
- **状态**：已实现
- **设计文档**：docs/superpowers/plans/2026-06-01-phase-7-knowledge.md
- **代码**：server/routes/knowledge.py, client/src/stores/knowledgeStore.ts, client/src/views/KnowledgeView.vue
- **变更记录**：

## 7. 系统设置
- **功能**：AI 模型配置、外观个性化（主题/语言）、数据隐私（导出/清空/删除）、关于页
- **状态**：已实现
- **设计文档**：docs/superpowers/plans/2026-06-01-phase-8-settings.md
- **代码**：client/src/stores/settingsStore.ts, client/src/views/SettingsView.vue
- **变更记录**：
