---
name: 技术选型决策记录
description: 2026-06-01 确定技术栈：Vue 3 + FastAPI REST/WebSocket + SQLite (sqlite3)
type: project
created_at: 2026-06-01 18:50
updated_at: 2026-06-01 18:50
---

## 后端从 Node.js 切换到 Python FastAPI

**Why:** 用户决定用纯 Python 做后端，保持学习一致性。

**How to apply:**
- 数据库用 Python 内置 sqlite3 手写 SQL（不用 SQLAlchemy，对 Java 程序员太复杂），迁移用手写 .sql 文件
- 通信方案 B：HTTP REST 负责 CRUD，WebSocket 负责流式聊天
- 不需要 Redis、MongoDB —— 单用户本地应用 SQLite 完全够用
- 不需要 Maven/Gradle 类构建工具 —— Python 直跑源码，pip 管依赖

## 已完成的文档

- 产品 PRD：7 个模块全部有独立文档，新增"系统设置"补齐缺口
- 技术设计：`docs/superpowers/specs/` 下有架构文档 + 数据库文档（分开存放）
- 实施计划：`docs/superpowers/plans/` 下 8 个阶段计划，从零搭建到全部功能

## 用户背景
Java 程序员，刚接触 Vue/Pinia/WebSocket/HTTP 协议层概念。
