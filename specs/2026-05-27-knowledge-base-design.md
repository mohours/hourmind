# HourMind — 个人知识库（Second Brain）模块 技术设计规格

**日期**：2026-05-27
**版本**：v2.0（纯 SQLite 方案）
**范围**：Phase 2（文件上传 + 列表 + 搜索 + 预览 + 标签 + 知识卡片）

> **状态**：本模块尚未实现，属于 Phase 2 开发范围。当前仅存储设计规格供后续参考。

---

## 1. 架构决策

| 决策点 | 选择 |
|--------|------|
| 文件存储 | 本地文件系统（`data/knowledge_files/{doc_id}/`），数据库只存路径和元数据 |
| 文件解析 | Node.js 端使用 pdf-parse / mammoth / marked 等 npm 包直接解析 |
| 语义搜索 | MVP 阶段使用 SQLite LIKE 关键词匹配；后续迁移 PostgreSQL + pgvector 后升级为向量检索 |
| 对话中引用知识库 | `@知识库` 指令触发关键词搜索 |

---

## 2. 数据模型（SQLite）

### 2.1 `KnowledgeDocument` — 知识文档

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| title | String | 文档标题 |
| content | String | 文档全文 |
| summary | String? | 自动生成摘要 |
| filePath | String? | 原始文件路径 |
| fileType | String | `pdf` / `docx` / `md` / `txt` / `manual` |
| fileSize | Int? | 文件大小（bytes） |
| isIndexed | Boolean | 是否已解析 |
| tags | String | JSON 字符串（标签数组） |
| folder | String? | 文件夹路径 |
| metadata | String | JSON（文件元数据） |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 2.2 `KnowledgeCard` — 知识卡片

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String @id | 主键 UUID |
| documentId | String | FK → KnowledgeDocument |
| title | String | 卡片标题 |
| content | String | 富文本内容 |
| tags | String | JSON（标签） |
| isPinned | Boolean | 置顶 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## 3. API 接口（规划）

| action | 说明 | payload |
|--------|------|---------|
| `knowledge.list` | 文档列表 | `search?`, `tag?`, `folder?`, `fileType?` |
| `knowledge.get` | 文档详情 | `documentId` |
| `knowledge.create_note` | 创建笔记 | `title`, `content`, `tags?` |
| `knowledge.update` | 编辑文档 | `documentId`, `title?`, `content?` |
| `knowledge.delete` | 删除文档 | `documentId` |
| `knowledge.search` | 关键词搜索 | `query` → 返回匹配文档 |
| `knowledge.cards.list` | 卡片列表 | `documentId?` |
| `knowledge.cards.create` | 创建卡片 | `documentId`, `title`, `content` |
| `knowledge.cards.delete` | 删除卡片 | `cardId` |

### 文件上传（REST）

```
POST /api/knowledge/upload
Content-Type: multipart/form-data
Body: file + tags? + folder?

流程：
  1. Node.js 存文件到 data/knowledge_files/{doc_id}/
  2. 根据 fileType 选解析器（pdf/md/txt/docx）
  3. 提取全文 → 写入 content
  4. 标记 isIndexed = true
```

---

## 4. 前端路由与组件树（规划）

### 路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/knowledge` | KnowledgeView | 知识库三栏布局 |

### 组件树

```
views/
  └── KnowledgeView.vue              # 页面容器

components/knowledge/
  ├── KnowledgeToolbar.vue           # 顶部栏（搜索 + 上传 + 新建）
  ├── KnowledgeFolderTree.vue        # 左侧文件夹树 + 标签云
  ├── KnowledgeDocList.vue           # 中间文档列表
  └── KnowledgeDetailPanel.vue       # 右侧预览面板
```

---

## 5. 后续升级路径

| 当前（SQLite MVP） | 升级后（PostgreSQL + pgvector） |
|-------------------|-------------------------------|
| LIKE 关键词搜索 | 语义向量检索（pgvector cosine 距离） |
| 手动创建知识卡片 | AI 自动生成卡片摘要 |
| Node.js npm 包解析文件 | 可选引入 Python 解析（更好的中文支持） |
| 单文件存储 | 分块存储 + embedding |
