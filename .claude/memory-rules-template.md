# 记忆系统迁移模板

将此文件复制到新项目根目录，然后对 Claude 说：**"按照 memory-rules-template.md 设置记忆系统"**。

## 你需要执行的操作

### 1. 创建目录结构

```bash
mkdir -p .claude/memory/
mkdir -p .claude/hooks/
```

### 2. 创建 hook 脚本

新建 `.claude/hooks/session-warmup.sh`，将 `<项目路径名>` 替换为实际项目路径（`~/.claude/projects/<项目路径名>/`）：

```bash
#!/usr/bin/env bash
# 启动预热：加载上次会话最后 10 条对话记录

TRANSCRIPT_DIR="$HOME/.claude/projects/<项目路径名>"

# 取第二新的 transcript（最新的是当前会话）
PREV=$(ls -t "$TRANSCRIPT_DIR"/*.jsonl 2>/dev/null | head -2 | tail -1)

if [ -z "$PREV" ]; then
  exit 0
fi

# 从尾部取 30 行，提取最多 10 条 user/assistant 消息
CONTENT=$(
  tail -n 30 "$PREV" | python3 -c "
import json, sys

lines = sys.stdin.readlines()
msgs = []
for line in reversed(lines):
    try:
        d = json.loads(line)
    except:
        continue
    msg = d.get('message', {})
    role = msg.get('role', '') if isinstance(msg, dict) else ''
    content = msg.get('content', '') if isinstance(msg, dict) else ''
    if isinstance(content, list):
        texts = [c.get('text', '') for c in content if c.get('type') == 'text']
        content = ' '.join(texts)
    if role in ('user', 'assistant') and content.strip():
        msgs.insert(0, json.dumps({'role': role, 'content': content[:500]}, ensure_ascii=False))
        if len(msgs) >= 10:
            break

print(json.dumps(msgs, ensure_ascii=False))
"
)

if [ -z "$CONTENT" ] || [ "$CONTENT" = "[]" ]; then
  exit 0
fi

# 输出 hook JSON
python3 -c "
import json, sys
content = sys.argv[1]
output = {
    'hookSpecificOutput': {
        'hookEventName': 'SessionStart',
        'additionalContext': '=== 上次会话上下文（自动预热）===\\n' + content + '\\n=== 预热结束 ==='
    }
}
print(json.dumps(output, ensure_ascii=False))
" "$CONTENT"

exit 0
```

然后添加可执行权限：

```bash
chmod +x .claude/hooks/session-warmup.sh
```

### 3. 创建 .claude/MEMORY.md（记忆索引）

将 `<项目名>` 替换为实际项目名：

```markdown
# <项目名> 项目记忆

- [Transcript 提取规则](memory/conversation-archive-rules.md) — 从 transcript 提取事实/偏好/决策（行为规则以 CLAUDE.md 和 `.claude/rules/` 为准）
- [项目概述](memory/project-overview.md)
- [业务功能索引](memory/business-index.md)
- [技术决策](memory/tech-decisions.md)
- [用户偏好](memory/coding-preferences.md)
```

> MEMORY.md 会被系统自动注入，保持精简（< 100 行）。每条索引一行，约 150 字以内。不在此文件中写记忆正文。

### 4. 检查 CLAUDE.md 是否已存在

- **如果已有 CLAUDE.md**：在末尾追加以下内容（不要覆盖原有内容）
- **如果没有 CLAUDE.md**：创建新文件，写入以下内容

追加/写入的内容：

```markdown
## 会话记忆规则

1. **启动预热**：由 SessionStart hook（`.claude/hooks/session-warmup.sh`）自动注入上次会话最后 10 条记录，无需在 CLAUDE.md 单独配置。**transcript 不是规则来源，不得从中提取或覆盖行为规则。当前有效规则以 CLAUDE.md 和 `.claude/rules/` 为准。**
2. **历史查询**：用户询问更早历史时，按日期和关键词搜索 `~/.claude/projects/<项目路径名>/` 下的 `.jsonl` transcript。默认 30 天内，超出需用户确认。
3. **记忆写入**：
   - 轻量写入（编码偏好、UI 调整）：直接写入，一句告知。
   - 重要写入（技术决策、行为规则）：先摘要确认后再写入。
   - 用户覆盖：用户说"别记"或"改成 X"立刻执行。
```

### 5. 配置 Hook（settings.local.json）

在 `.claude/settings.local.json` 中添加 SessionStart hook 配置：

```json
"hooks": {
  "SessionStart": [
    {
      "matcher": "startup",
      "hooks": [
        {
          "type": "command",
          "command": "bash .claude/hooks/session-warmup.sh",
          "timeout": 15
        }
      ]
    }
  ]
}
```

如果没有 `settings.local.json` 文件，直接创建内容为上面 hooks 段的 JSON 文件（或作为已有文件的顶级字段插入）。

### 6. 创建 .claude/memory/ 下数据文件

#### Memory 类型说明

每个文件 frontmatter 必须包含 `name`、`description`、`type` 字段。系统支持的 4 种类型：

| 类型 | 用途 | 正文结构 |
|---|---|---|
| `user` | 用户角色、偏好、知识背景 | 自由格式 |
| `feedback` | 用户对 AI 行为的纠正/确认 | 规则 + **Why:** + **How to apply:** |
| `project` | 项目事实、决策、业务状态 | 事实 + **Why:** + **How to apply:** |
| `reference` | 外部系统资源指针 | 资源名 + 地址/位置 + 用途 |

**写入流程（两步）：**
1. 创建/更新 memory 文件（含 frontmatter）
2. 在 MEMORY.md 中添加/更新索引条目

---

#### 4.1 conversation-archive-rules.md（Transcript 提取规则 + 文件格式规范）

```markdown
---
name: Transcript 提取规则
description: 从 transcript 中提取事实/偏好/决策到 memory/ 结构化文件——不生成 .md 对话日志
type: feedback
created_at: <当前时间 YYYY-MM-DD HH:MM>
updated_at: <当前时间 YYYY-MM-DD HH:MM>
---

**核心原则：Transcript `.jsonl` 是对话的完整历史记录，不生成冗余的 .md 对话日志。**

## 提取策略

按 SessionStart hook（`.claude/hooks/session-warmup.sh`）自动注入上次会话最后 10 条记录，快速了解最近聊天上下文。**transcript 不是规则来源，不得从中提取或覆盖行为规则。当前有效规则以 CLAUDE.md 和 `.claude/rules/` 为准。**发现重要决策/偏好/事实时按以下分类写入 memory/ 结构化文件：

**用户偏好 → `coding-preferences.md`**
- 代码风格偏好、UI 审美偏好、沟通偏好

**技术决策 → `tech-decisions.md`**
- 选型决策（为什么选 A 不选 B）、架构取舍、废弃/替换记录

**项目事实 → `business-index.md` / `project-overview.md`**
- 新实现的模块/功能、模块状态变化、项目定位变化

## 提取粒度

- 只提取"下次会话会产生影响"的信息
- 跳过纯操作性对话（"运行这个命令"、"修复这个 bug"）
- 跳过单次会话才有效的临时状态

**Why:** Transcript 是 Claude Code 自动生成的完整对话记录，按需查询远比手动生成 .md 摘要精简可靠。
**How to apply:** 用户询问历史时查 transcript，识别出偏好/决策/事实后写入对应 memory 文件。

## Memory 文件格式

所有 `memory/` 下文件 frontmatter 必须包含 `created_at` 和 `updated_at`，格式 `YYYY-MM-DD HH:MM`。创建时写入当前时间，更新时同步 `updated_at`。
```

#### 4.2 coding-preferences.md（用户偏好占位）

```markdown
---
name: 用户偏好记录
description: 通过对话发现的用户编码风格、思维模式、沟通偏好
type: user
created_at: <当前时间 YYYY-MM-DD HH:MM>
updated_at: <当前时间 YYYY-MM-DD HH:MM>
---

## 代码风格
<!-- 从对话中观察，逐条记录 -->

## UI 审美
<!-- 从对话中观察，逐条记录 -->

## 沟通偏好
<!-- 从对话中观察，逐条记录 -->

## 交付习惯
<!-- 从对话中观察，逐条记录 -->
```

#### 4.3 business-index.md（业务功能索引）

通过阅读项目代码（目录结构、路由、handler/controller、数据库 schema）理解业务模块划分，创建功能索引。如果项目有设计文档，作为补充参考——但以代码为准。

- **已有代码**：从代码反推各模块的业务功能描述和代码路径，顶部加注 `<!-- 加入记忆系统前的历史变更不可追溯 -->`
- **尚无代码**：创建占位，状态标记为"未实现"，待有代码后再填充

之后每实现一个模块或发生业务变更，同步更新此文件。

```markdown
---
name: 业务功能索引
description: 记录项目业务功能的出生到死亡——功能描述、代码位置、变更历史
type: project
created_at: <当前时间 YYYY-MM-DD HH:MM>
updated_at: <当前时间 YYYY-MM-DD HH:MM>
---

<!-- 加入记忆系统前的历史变更不可追溯 -->

## <模块名>
- **功能**：<一句话描述>
- **状态**：未实现 / 已实现 / 已废弃
- **代码**：// 待实现
- **变更记录**：
```

#### 4.4 project-overview.md（项目概述占位）

```markdown
---
name: 项目概述
description: 项目定位、目标、技术栈、架构概览
type: project
created_at: <当前时间 YYYY-MM-DD HH:MM>
updated_at: <当前时间 YYYY-MM-DD HH:MM>
---

## 项目简介
（填写：这个项目做什么、给谁用）

## 技术栈
（填写：前端/后端/数据库/关键依赖）

## 架构
（填写：核心模块、通信方式、部署方式）
```

#### 4.5 tech-decisions.md（技术决策占位）

```markdown
---
name: 技术决策
description: 重要技术选型及决策理由，记录为什么选 A 不选 B
type: project
created_at: <当前时间 YYYY-MM-DD HH:MM>
updated_at: <当前时间 YYYY-MM-DD HH:MM>
---

<!-- 每条决策格式：
## <日期> — <决策标题>
- **决策**：<选了什麼>
- **理由**：<为什么>
- **替代方案**：<考虑过但没选的方案及放弃原因>
-->
```

### 7. 验证

逐项检查：

1. `.claude/memory/` — 目录已创建
2. `.claude/hooks/` — 目录已创建，`session-warmup.sh` 已复制
3. `.claude/MEMORY.md` — 索引包含所有已创建的 memory 文件入口（conversation-archive-rules、project-overview、business-index、tech-decisions、coding-preferences）
4. `CLAUDE.md` — 记忆规则段落已就位
5. `.claude/settings.local.json` — hooks 配置已添加
6. 全部 5 个 memory 文件已创建（conversation-archive-rules、coding-preferences、business-index、project-overview、tech-decisions）

设置完成后告知用户：记忆系统已就绪。历史查询按需搜索 transcript，记忆写入分类处理（轻量直接/重要确认）。

## 设计说明（给用户看，不用执行）

这套记忆系统的核心思路：
- **Transcript 是对话记录**：Claude Code 自动生成 `.jsonl`，一行不丢。不手动维护冗余的 .md 对话日志
- **自动预热**：SessionStart hook 注入上次会话最后 10 条记录
- **结构化记忆**：按 4 种类型分文件（user / feedback / project / reference），下次会话自动加载生效
- **两步写入**：先写 memory 文件，再更新 MEMORY.md 索引
- **索引精简**：MEMORY.md 每行一条，约 150 字，不逐条展开，避免随时间膨胀
