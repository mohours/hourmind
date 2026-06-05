# 技术决策记录

## 后端从 Node.js 切换到 Python FastAPI（2026-06-01）
- **决策**：纯 Python FastAPI 做后端，放弃 Node.js
- **理由**：用户学习 Python，保持技术栈一致性
- **详情**：数据库用 Python 内置 sqlite3 手写 SQL（不用 SQLAlchemy），通信方案为 HTTP REST（CRUD）+ WebSocket（流式聊天），不需要 Redis/MongoDB

## 项目架构
- 单用户本地应用，SQLite 完全够用
- Python 直跑源码，pip 管依赖，不需要构建工具
- 前端 Vite 代理 `/api` → 后端 8000，`/ws` → WebSocket 8000

## 技术栈
- 前端：Vue 3 + TypeScript + Vite + Pinia (port 5173)
- 后端：Python 3 + FastAPI + sqlite3 (port 8000)
- 数据库：SQLite (server/data/hourmind.db)
- UI：Quantum Glass 主题 (client/src/style.css)
