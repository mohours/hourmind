# 全局持久记忆系统 — 设计文档

## 1. 目标

建立跟随用户一生的双层记忆系统：
- **全局记忆**：定义 AI 人格与用户画像，跨所有项目，跟人走
- **项目记忆**：记录项目全生命周期，跟项目走
- **衔接机制**：通过"项目镜像"（project mirror），全局记忆可无缝读取项目记忆中的任意文件

## 2. 架构总览

```
~/.claude/                              ← 全局（跟人，跨所有项目）
│
├── MEMORY.md                           ← 全局记忆索引（系统自动注入）
│
├── rules/                              ← 行为规范（系统自动注入全部 .md）
│   ├── SOUL.md                         ← AI 核心价值观 & 行为底线（不可变）
│   ├── IDENTITY.md                     ← AI 身份 & 角色定位
│   ├── AGENTS.md                       ← SOP 操作手册（代码规范、安全边界）
│   ├── USER.md                         ← 用户画像（技术栈、习惯、偏好）
│   └── TOOLS.md                        ← 环境备忘录（可用工具、项目路径）
│
└── memory/                             ← 记忆数据（我主动按需读取）
    ├── preferences.md                  ← 编码 / UI / 沟通偏好
    ├── skills.md                       ← 技能成长轨迹
    ├── decisions.md                    ← 跨项目重大决策
    ├── concepts.md                     ← 已掌握的核心概念
    ├── projects/                       ← 项目镜像（全局对项目的认知 + 记忆索引）
    │   ├── hourmind.md
    │   └── guangt.md
    └── conversations/                  ← 全局对话日志（不在项目内时产生）
        └── YYYY-MM/
            └── YYYY-MM-DD.md


<项目>/.claude/                          ← 项目（跟项目走，可与代码一起提交 git）
│
├── CLAUDE.md                           ← 项目架构 & 开发规范（系统自动注入）
├── MEMORY.md                           ← 项目记忆索引（系统自动注入）
├── rules/                              ← 行为规范（系统自动注入全部 .md）
│   ├── SOUL.md                         ← AI 核心价值观 & 行为底线（不可变）
│   ├── IDENTITY.md                     ← AI 身份 & 角色定位
│   ├── AGENTS.md                       ← SOP 操作手册（代码规范、安全边界）
│   ├── USER.md                         ← 用户画像（技术栈、习惯、偏好）
│   └── TOOLS.md                        ← 环境备忘录（可用工具、项目路径）
│
└── memory/
    ├── project-overview.md             ← 项目概述
    ├── tech-decisions.md               ← 技术选型 & 决策记录
    ├── business-index.md               ← 业务功能索引（出生到死亡）
    ├── conversation-archive-rules.md   ← 对话归档规则
    ├── memory-format.md                ← 时间戳格式规范
    └── conversations/                  ← 项目内对话日志
        └── YYYY-MM/
            └── YYYY-MM-DD.md
```

## 3. 启动加载流程

```
每次对话启动：

【系统自动注入 —— 无需任何规则，Claude Code 硬性加载】
  ├── ~/.claude/rules/SOUL.md          → AI 核心价值观
  ├── ~/.claude/rules/IDENTITY.md      → AI 身份 & 角色
  ├── ~/.claude/rules/AGENTS.md        → SOP 操作手册
  ├── ~/.claude/rules/USER.md          → 用户画像
  ├── ~/.claude/rules/TOOLS.md         → 环境 & 路径信息
  ├── ~/.claude/MEMORY.md              → 全局记忆索引
  ├── 项目/CLAUDE.md                   → 项目架构（仅项目目录内）
  └── 项目/.claude/MEMORY.md           → 项目记忆索引（仅项目目录内）

【我主动按需读取 —— 根据对话需要展开】
  └── ~/.claude/memory/*               → 项目细节、技能状态、偏好、某天对话
```

**三层加载机制对比：**

| 层 | 路径 | 机制 | 内容 | 数量控制 |
|---|---|---|---|---|
| rules/ | `~/.claude/rules/` | 系统自动注入 | 5 个人格+规范文件 | 稳定，不膨胀 |
| 索引 | `~/.claude/MEMORY.md` | 系统自动注入 | 记忆文件目录 | <100 行，精简 |
| 数据 | `~/.claude/memory/` | 我主动按需读取 | 偏好/技能/决策/项目/对话 | 持续增长 |

## 4. 核心文件规格

### 4.1 ~/.claude/rules/SOUL.md

AI 的灵魂文件——定义核心价值观、沟通风格、行为底线。不可随意修改，确保 AI 行为一致性。

```markdown
# Soul

## 核心价值观
- 真诚 —— 不奉承、不说假话、不假装同意
- 干练 —— 先给结论，再给方案，不废话
- 好奇心 —— 主动追问需求背后的真实原因
- 技术严谨 —— 代码可运行、安全、有注释

## 沟通风格
- 始终用中文回复，技术术语保持英文原名
- 用 Java 概念类比解释新技术
- 做改动前先讨论方案确认

## 行为底线
- 不暴露加密密钥、密码等敏感信息
- 不做可能破坏代码库的不可逆操作（需确认）
- 不绕过安全校验（--no-verify 等）
- 不能主动操作数据库
```

### 4.2 ~/.claude/rules/IDENTITY.md

```markdown
# Identity

- 我是：Claude Code
- 角色：私人技术助理 & 第二大脑
- 定位：编程伙伴、架构顾问、记忆管家
```

### 4.3 ~/.claude/rules/AGENTS.md

```markdown
# Agents

## 代码规范
- 每行代码必须有中文注释
- 优先使用原生方案，不过度引入框架
- 先出设计文档，用户确认后再实现

## 安全边界
- rm -rf / git push --force 需确认
- 不修改 .env / credentials 需确认

## 报错处理
- 先诊断根因，再修复，不绕过校验
```

### 4.4 ~/.claude/rules/USER.md

```markdown
# User

## 基本信息
- 角色：全栈开发 + 产品设计
- 背景：Java 程序员，正在学习 Python / Vue / WebSocket
- 语言：中文母语

## 技术栈
- 后端：Java（Spring Boot, MyBatis-Plus）、Python（FastAPI）
- 前端：Vue 3, TypeScript, Pinia
- 数据库：MySQL, SQLite
- 工具：Git, Maven, npm

## 编码偏好
- UI：科技感流光溢彩（玻璃拟态、深色主题）
- 方案：能原生不用框架，先计划再动手

## 习惯
- 工作时间：8:30 - 17:30
- 结束信号："下班了"、"再见"、"结束"
```

### 4.5 ~/.claude/rules/TOOLS.md

```markdown
# Tools

## 环境
- OS: macOS / Shell: zsh / 用户目录: /Users/hours/

## 可用工具
- Playwright（浏览器测试）
- git / npm / Python venv

## 项目路径
- HourMind: /Users/hours/hourmind
- ft_puff_gt: /Users/hours/idea/ft/guangt
```

### 4.6 ~/.claude/MEMORY.md

全局记忆索引，已注入的内容不在此重复—只列 `memory/` 下的数据文件入口。

```markdown
# 全局记忆

## 偏好 → [memory/preferences.md](memory/preferences.md)
## 技能 → [memory/skills.md](memory/skills.md)
## 决策 → [memory/decisions.md](memory/decisions.md)
## 概念 → [memory/concepts.md](memory/concepts.md)
## 项目
- [HourMind](memory/projects/hourmind.md)
- [ft_puff_gt](memory/projects/guangt.md)
## 对话 → [memory/conversations/](memory/conversations/)
```

## 5. 项目镜像格式

`~/.claude/memory/projects/hourmind.md` — 全局对项目的"认知入口"。含项目元信息 + 项目记忆索引，全局可通过此文件直接定位并读取项目中的任意记忆文件：

```markdown
---
name: HourMind
description: 个人 AI 助理，多模型对话 + 知识库 + 待办
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
HourMind（小时智脑）私人第二大脑 + 多模型 AI 助理。
技术栈：Python FastAPI + sqlite3 / Vue 3 + TypeScript + Pinia
状态：全部 8 阶段已实现，Quantum Flow 主题在线。

## 项目记忆索引

### 架构 & 决策
- [项目概述](memory/project-overview.md)
- [技术决策](memory/tech-decisions.md) — Node.js→Python、SQLAlchemy→sqlite3

### 业务功能 ([完整索引](memory/business-index.md))
0. 项目骨架 ✅ | 1. 认证系统 ✅ | 2. API Key管理 ✅
3. 智能对话 ✅ | 4. 仪表盘 ✅ | 5. 待办 ✅ | 6. 知识库 ✅ | 7. 系统设置 ✅

### 对话日志
- [conversations/](memory/conversations/) — 按月归档

### 关键决策
- 06-01: Node.js → Python FastAPI
- 06-01: SQLAlchemy → 原生 sqlite3
- 06-02: Quantum Flow 全站主题
- 06-03: 待办智能解析 + 分优先级提醒
```

## 6. 晋升机制

用户主动触发，将项目记忆中的内容提取到全局记忆：

```
触发词 → 行为：
  "把这个记到主记忆"  → 分析上下文，提取关键信息写入合适的 memory/ 文件
  "把XX经验记到技能里" → 指定目标写入 memory/skills.md
  "更新项目镜像"       → 同步项目 business-index.md 到 projects/xxx.md

流程：
  1. 用户说触发词
  2. 我分析当前会话上下文 + 项目 memory 变化
  3. 确定目标文件（skills/decisions/projects/concepts/preferences）
  4. 写入/更新，同步 updated_at
  5. 回显确认写入内容
```

## 7. 对话日志规则

| 场景 | 存储位置 |
|------|---------|
| 在项目目录内对话 | `项目/.claude/memory/conversations/YYYY-MM/YYYY-MM-DD.md` |
| 不在任何项目内（~/ 等） | `~/.claude/memory/conversations/YYYY-MM/YYYY-MM-DD.md` |

- **格式**：交错对话（用户原文 + Claude 一行摘要），按天分文件，多次会话用 `### 第N次` 分隔
- **自动补录**：启动时检查 transcript 是否缺档，自动补录，无需确认

## 8. 与现有系统的关系

| 现有（项目级） | 迁移后 |
|---|---|
| `项目/.claude/memory/coding-preferences.md` | → `~/.claude/memory/preferences.md`（迁出，从项目删除） |
| `项目/.claude/memory/business-index.md` | 保留不动 |
| `项目/.claude/memory/tech-decisions.md` | 保留不动 |
| `项目/.claude/memory/conversations/` | 保留不动 |
| `项目/CLAUDE.md` | 去掉对 coding-preferences 的引用，新增启动时读取 `~/.claude/memory/MEMORY.md` 的规则 |

## 9. 执行步骤

1. 创建目录：`~/.claude/rules/` + `~/.claude/memory/{preferences,skills,decisions,concepts,projects,conversations}`
2. 创建 `~/.claude/MEMORY.md`
3. 编写 5 个 rules 文件：SOUL / IDENTITY / AGENTS / USER / TOOLS
4. 从 HourMind 项目提取 preferences → `~/.claude/memory/preferences.md`
5. 为已有项目创建镜像：`projects/hourmind.md`、`projects/guangt.md`
6. 更新项目 CLAUDE.md：移除 coding-preferences.md 引用
7. 从 HourMind 项目删除 `coding-preferences.md`
8. 提交并验证启动流程
