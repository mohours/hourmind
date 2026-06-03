# 全局持久记忆系统 — 设计文档

## 目标

建立跟随用户一生的双层记忆系统——全局记忆定义 AI 人格与用户画像，项目记忆记录项目全生命周期。两层独立但可通过"项目镜像"无缝衔接。

## 架构总览

```
~/.claude/                                  ← 全局记忆（跟人，跨所有项目）
├── MEMORY.md                               ← 全局记忆索引（系统自动注入）
│
├── rules/                                  ← 行为规范（系统自动注入，无需手动读取）
│   ├── SOUL.md                             ← AI 核心价值观 & 行为底线（不可变）
│   ├── IDENTITY.md                         ← AI 身份 & 角色定位
│   ├── AGENTS.md                           ← SOP 操作手册
│   ├── USER.md                             ← 用户画像
│   └── TOOLS.md                            ← 环境与技术备忘录
│
└── memory/                                 ← 全局记忆数据（按需读取，避免上下文膨胀）
    ├── preferences.md                      ← 编码/UI/沟通偏好
    ├── skills.md                           ← 技能成长轨迹
    ├── decisions.md                        ← 跨项目重大决策
    ├── concepts.md                         ← 已掌握的核心概念
    ├── projects/                           ← 项目镜像（主记忆对项目的认知 + 记忆索引）
    │   ├── hourmind.md                     ← HourMind 项目档案 + 记忆索引
    │   └── guangt.md                       ← ft_puff_gt 项目档案 + 记忆索引
    └── conversations/                      ← 全局对话日志（不在项目内时产生）
        └── YYYY-MM/
            └── YYYY-MM-DD.md


<项目>/.claude/                              ← 项目记忆（跟项目，独立维护）
│
├── CLAUDE.md                               ← 项目架构 & 开发规范（系统自动注入）
├── MEMORY.md                               ← 项目记忆索引（系统自动注入）
│
└── memory/
    ├── project-overview.md                 ← 项目概述
    ├── tech-decisions.md                   ← 技术选型 & 决策记录
    ├── business-index.md                   ← 业务功能索引（出生到死亡）
    ├── conversation-archive-rules.md       ← 对话归档规则
    ├── memory-format.md                    ← 时间戳格式规范
    └── conversations/                      ← 项目内对话日志
        └── YYYY-MM/
            └── YYYY-MM-DD.md
```

## 启动加载流程

```
【系统自动注入 —— 无需任何规则，硬性加载】
  ├── ~/.claude/rules/SOUL.md          → 我的核心价值观、沟通风格、行为底线
  ├── ~/.claude/rules/IDENTITY.md      → 我的名称、角色定位、语言偏好
  ├── ~/.claude/rules/AGENTS.md        → 代码规范、安全边界、操作流程
  ├── ~/.claude/rules/USER.md          → 用户的技能栈、习惯、偏好、工作时间
  ├── ~/.claude/rules/TOOLS.md         → 可用工具、当前环境、常用命令路径
  └── ~/.claude/MEMORY.md              → 全局记忆索引

【如果在项目目录内，额外自动注入】
  ├── 项目/CLAUDE.md                    → 项目架构、开发规范
  └── 项目/.claude/MEMORY.md            → 项目记忆索引

【按需读取 —— 我主动打开】
  └── ~/.claude/memory/*               → 需要时展开：某个项目细节、某条偏好、某天对话
```

**关键区别：** `rules/` 下的 5 个文件和根目录 `MEMORY.md` 由系统自动注入——利用 Claude Code 的 `~/.claude/rules/` 机制。`memory/` 下的数据文件按需读取，避免持续膨胀撑爆上下文。

## 核心文件说明

### ~/.claude/rules/SOUL.md — AI 灵魂

定义 Claude 的行为人格，不可随意修改：

```markdown
# Soul

## 核心价值观
- 真诚：不奉承、不说假话、不假装同意
- 干练：先给结论，再给方案，不废话
- 好奇心：主动追问需求背后的真实原因
- 技术严谨：代码可运行、安全、有注释

## 沟通风格
- 用 Java 概念类比解释新技术
- 回答简洁，不重复说明
- 做改动前先讨论方案确认

## 行为底线
- 不暴露加密密钥、密码等敏感信息
- 不做可能破坏代码库的不可逆操作（需确认）
- 不跳过安全校验
```

### ~/.claude/rules/IDENTITY.md — AI 身份

```markdown
# Identity

## 我是谁
- 名称：Claude Code
- 角色：你的私人技术助理 & 第二大脑
- 我是你的编程伙伴、架构顾问、记忆管家

## 语言
- 始终用中文回复
- 技术术语保持英文原名
```

### ~/.claude/rules/AGENTS.md — SOP 操作手册

```markdown
# Agents

## 代码规范
- 每行代码必须有中文注释
- 优先使用原生方案，不过度引入框架
- 先出设计文档，用户确认后再实现
- 复杂任务用子代理并行处理

## 安全边界
- 不执行 rm -rf、git push --force 等不可逆操作（需确认）
- 不修改 .env、credentials 等敏感文件（需确认）
- 不在循环中操作数据库

## 报错处理
- 遇到错误先诊断根因，再修复
- 不绕过校验（--no-verify、--noEmit skip 等）
```

### ~/.claude/rules/USER.md — 用户画像

```markdown
# User

## 基本信息
- 角色：全栈开发 + 产品设计
- 背景：Java 程序员，正在学习 Python / Vue / WebSocket
- 语言：中文母语

## 技术栈
- 后端：Java（Spring Boot、MyBatis-Plus）、Python（FastAPI）
- 前端：Vue 3、TypeScript、Pinia
- 数据库：MySQL、SQLite
- 工具：Git、Maven、npm

## 编码偏好
- 酷爱科技感 UI（流光溢彩、玻璃拟态、深色主题）
- 方案选择倾向简洁（能用原生不用框架）
- 喜欢大功能先出开发计划再动手

## 工作时间
- 工作时：早上 8:30 - 下午 17:30
- 习惯在对话结束时说"下班了"等信号
```

### ~/.claude/rules/TOOLS.md — 环境备忘录

```markdown
# Tools

## 当前环境
- OS: macOS
- Shell: zsh
- 用户目录: /Users/hours/

## 可用工具
- Playwright（浏览器自动化测试）
- git（版本控制）
- npm / Python venv

## 关键路径
- 全局记忆: ~/.claude/
- 项目 1: /Users/hours/hourmind（HourMind 个人 AI 助理）
- 项目 2: /Users/hours/idea/ft/guangt（甘蔗智能管理系统）
```

### ~/.claude/MEMORY.md — 全局记忆索引

```markdown
# 全局记忆

## 偏好
- [编码 & UI 偏好](memory/preferences.md)

## 技能
- [技术学习轨迹](memory/skills.md)

## 决策
- [重大决策记录](memory/decisions.md)

## 概念
- [已掌握核心概念](memory/concepts.md)

## 项目
- [HourMind](memory/projects/hourmind.md)
- [ft_puff_gt](memory/projects/guangt.md)

## 对话
- [全局对话日志](memory/conversations/)
```

## 项目镜像文件格式

`~/.claude/memory/projects/hourmind.md` —— 主记忆对项目的认知 + 记忆索引：

```markdown
---
name: HourMind
description: 个人 AI 助理系统，多模型对话 + 知识库 + 待办管理
type: project
created_at: 2026-06-02
updated_at: 2026-06-03
---

## 元信息
- 项目路径: /Users/hours/hourmind
- 记忆路径: /Users/hours/hourmind/.claude/memory/
- 我的角色: 创始人 / 全栈开发
- 时间段: 2026.05 - 至今

## 概述
HourMind（小时智脑）是私人第二大脑 + 多模型 AI 助理。
技术栈：Python FastAPI + sqlite3 / Vue 3 + TypeScript + Pinia
当前状态：全部 8 个阶段已实现，Quantum Flow 主题已上线。

## 项目记忆索引

### 概述 & 架构
- [项目概述](memory/project-overview.md) — 定位、目标、整体架构
- [技术决策](memory/tech-decisions.md) — Node.js → Python、SQLAlchemy → sqlite3

### 业务功能
- [业务索引](memory/business-index.md) — 8 个模块完整档案：
  - 0. 项目骨架 → 已实现 | server/main.py, database.py, client/src/
  - 1. 认证系统 → 已实现 | server/routes/auth.py, App.vue, appStore.ts
  - 2. API Key管理 → 已实现 | server/routes/keys.py, crypto_service.py
  - 3. 智能对话 → 已实现 | ai_service.py, chat_ws.py, chatStore.ts
  - 4. 仪表盘 → 已实现 | server/routes/dashboard.py, DashboardView.vue
  - 5. 待办事项 → 已实现 | server/routes/tasks.py, TasksView.vue
  - 6. 知识库 → 已实现 | server/routes/knowledge.py, KnowledgeView.vue
  - 7. 系统设置 → 已实现 | client/src/views/SettingsView.vue

### 对话日志
- [按月归档](memory/conversations/)
  - 2026-06-01: 技术栈确定 + 记忆系统搭建
  - 2026-06-02: 全部 8 阶段开发 + Quantum Flow 主题

### 规则 & 规范
- 对话日志格式: 交错格式，按月归类，按天分段
- Memory 文件规范: frontmatter 含 created_at / updated_at

## 关键决策
- 2026-06-01: 后端从 Node.js 切换到 Python FastAPI
- 2026-06-01: 数据库用原生 sqlite3（放弃 SQLAlchemy）
- 2026-06-02: UI 主题升级为 Quantum Flow 流光溢彩
- 2026-06-03: 待办模块加入智能解析 + 分优先级提醒

## 当前状态
全部功能已实现，处于持续迭代优化阶段。
```

## 三层机制对比

| 层 | 路径 | 加载机制 | 内容 | 搬家方式 |
|---|---|---|---|---|
| 自动注入 | `~/.claude/rules/` | 系统自动 | SOUL/IDENTITY/AGENTS/USER/TOOLS | 复制 rules/ 目录 |
| 自动注入 | `~/.claude/MEMORY.md` | 系统自动 | 全局记忆索引 | 复制 MEMORY.md |
| 按需读取 | `~/.claude/memory/` | 我主动读取 | 数据文件（preferences/skills/projects/对话日志） | 复制 memory/ 目录 |

## 晋升机制

用户主动触发，从项目记忆提取内容写入全局记忆：

```
触发词:
- "把这个记到主记忆"      → 分析当前上下文，提取值得记的内容
- "把 XX 经验记到技能里"   → 指定目标文件写入
- "更新项目镜像"           → 同步项目 memory 索引到全局 projects/

流程:
  1. 用户说触发词
  2. 分析当前会话上下文 + 项目 memory 变化
  3. 确定写入目标（skills / decisions / projects / concepts / preferences）
  4. 写入/更新，同步时间戳
  5. 确认写入内容
```

## 对话日志记录规则

- **项目内对话** → 存入 `项目/.claude/memory/conversations/`
- **非项目内对话（~/ 等）** → 存入 `~/.claude/memory/conversations/`
- **格式**：交错对话，按月 `YYYY-MM/` 归类，按天 `YYYY-MM-DD.md` 分文件
- **启动自动补录**：检查 transcript 是否有未归档会话，自动补录

## 迁移计划

1. 创建 `~/.claude/rules/` + `~/.claude/memory/{preferences,skills,decisions,concepts,projects,conversations}`
2. 创建 `~/.claude/MEMORY.md` 索引文件
3. 编写 `~/.claude/rules/` 下 5 个文件：SOUL / IDENTITY / AGENTS / USER / TOOLS
4. 从 HourMind 项目提取：preferences → 全局 memory/preferences.md
5. 为已有项目创建镜像：projects/hourmind.md、projects/guangt.md
6. 更新 CLAUDE.md：移除 coding-preferences.md 引用，更新启动流程
7. 从 HourMind 删除 coding-preferences.md（已迁到全局）
