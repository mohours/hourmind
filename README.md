# HourMind - 小时智脑

私人第二大脑 + 多模型 AI 助理。支持多厂商 API Key 统一管理、流式对话、知识库、待办事项、仪表盘。

技术栈：Vue 3 + TypeScript + Vite + Pinia / Python 3 + FastAPI / SQLite

## 快速开始

### 后端

```bash
cd hourmind/server
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 编辑 .env 配置密钥
python main.py         # http://localhost:8000
```

### 前端

```bash
cd hourmind/client
npm install
npm run dev            # http://localhost:5173
```

## 功能

- 多厂商 AI API Key 统一管理（AES-256-GCM 加密存储）
- WebSocket 流式对话，支持中途取消
- 待办事项 + 子任务管理（优先级、截止日期、浏览器通知提醒）
- 知识库卡片管理 + 搜索
- 仪表盘数据概览
- GitHub OAuth 第三方登录
- Quantum Glass 主题（玻璃拟态 + 渐变辉光）

## 环境变量（hourmind/server/.env）

```env
JWT_SECRET=你的JWT签名密钥
ENCRYPTION_KEY=32字符AES加密密钥
PORT=8000

# GitHub OAuth（可选）
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```
