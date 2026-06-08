# OAuth 第三方登录系统 — 设计文档

日期: 2026-06-08 | 状态: draft

## 目标

在现有密码认证基础上，新增可插拔的 OAuth 2.0 第三方登录，优先接入 GitHub OAuth，预留给微信等平台的扩展能力。

## 约束

- 纯 localhost 开发环境，OAuth Provider 必须支持 `localhost` 回调
- 保持单用户系统，不引入用户表和多租户
- 密码登录保留为备选方案
- 每行代码都要写中文注释

## 架构概览

```
用户 → 前端登录页 → [OAuth 按钮] → 跳转第三方授权页 → 回调到后端
                  → [密码登录（备选）]
                  ↓
后端 /api/auth/oauth/* → 策略模式 Provider → 签发统一 JWT
```

Provider 层采用策略模式：每个第三方平台实现 `get_authorization_url()`、`exchange_code()`、`get_user_info()` 三个方法。

## 数据库变更

新增 `user_auth` 表：

```sql
CREATE TABLE IF NOT EXISTS user_auth (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,          -- 平台标识：github / wechat / google
    provider_user_id TEXT NOT NULL,  -- 第三方用户 ID
    provider_username TEXT,          -- 第三方用户名（展示用）
    access_token TEXT,               -- AES 加密存储的 access_token（备用）
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, provider_user_id)
);
```

作用：
- 记录已绑定的第三方账号
- 防止未绑定账号通过 OAuth 登入（首次绑定需先密码登录后操作，或在 setup 阶段直接绑定第一个 OAuth 账号）
- `access_token` 加密存储，用于后续调用第三方 API（如获取头像）

## 后端路由

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/auth/oauth/providers` | 无 | 返回启用的 Provider 列表（id + name + icon） |
| GET | `/api/auth/oauth/{provider}/login` | 无 | 返回 `{authorization_url}`，前端跳转 |
| GET | `/api/auth/oauth/{provider}/callback` | 无 | OAuth 回调，换 token 后重定向回前端带 JWT |
| POST | `/api/auth/oauth/{provider}/unlink` | JWT | 解绑第三方账号 |

### 流程详解

**OAuth 登录流程：**
1. 前端调 `GET /oauth/{provider}/login` 获取授权 URL
2. 前端 `window.location.href = authorization_url` 跳转 GitHub
3. 用户在 GitHub 授权后，GitHub 回调到 `GET /oauth/{provider}/callback?code=xxx&state=xxx`
4. 后端用 code 换 access_token，拿用户信息
5. 查 `user_auth` 表：已绑定 → 签发 JWT；未绑定且 `user_auth` 表为空（首次）→ 自动绑定并签发 JWT
6. 后端 302 重定向到前端首页 `/#/?token=xxx`

**首次使用场景：**
- 无密码、无绑定 → OAuth 登录自动视为首次绑定，同时创建 `user_auth` 记录
- 之后可设密码作为备选

### 安全措施

- `state` 参数防 CSRF（后端生成随机 token 存 Redis/内存 → 回调时校验）
- OAuth token 用现有 `crypto_service` AES-256-GCM 加密存储
- GitHub redirect_uri 严格校验，防止开放重定向

## Provider 设计（策略模式）

```python
# services/oauth/base.py
class OAuthProvider(ABC):
    @property
    def provider_id(self) -> str: ...     # github / wechat
    @property
    def provider_name(self) -> str: ...   # GitHub / 微信
    def get_authorization_url(self, state: str) -> str: ...
    async def exchange_code(self, code: str) -> dict: ...  # {access_token, ...}
    async def get_user_info(self, access_token: str) -> dict: ...  # {id, username}
```

**第一期实现：** `services/oauth/github.py`
**预留：** `services/oauth/wechat.py`（需公网域名 + 备案）

## 配置

新增环境变量（`.env`）：

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/auth/oauth/github/callback

# 微信 OAuth（预留，待公网部署后生效）
WECHAT_APP_ID=
WECHAT_APP_SECRET=
```

## 前端变更

### 登录页（LoginView.vue）

布局重构为"OAuth 优先"：

```
┌──────────────────────────────────┐
│  HourMind / 小时智脑              │
│  ┌──────────────────────────────┐ │
│  │  🔐 GitHub 账号登录    →     │ │  ← 主按钮，大号玻璃态
│  │  ─────────────────────────── │ │
│  │  使用密码登录（展开）         │ │  ← 小字链接
│  │  [密码输入框] [进入]         │ │  ← 折叠默认隐藏
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### 首页接收 token

`/#/?token=xxx` 参数由 `App.vue` 在 `onMounted` 时检测并存储到 localStorage。

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/db/schema.sql` | 修改 | 新增 user_auth 表 |
| `server/routes/auth.py` | 修改 | 新增 oauth 路由 |
| `server/services/oauth/__init__.py` | 新增 | Provider 注册 |
| `server/services/oauth/base.py` | 新增 | 抽象基类 |
| `server/services/oauth/github.py` | 新增 | GitHub Provider |
| `server/services/oauth/wechat.py` | 新增 | 微信 Provider（骨架） |
| `server/config.py` | 修改 | 加载 OAuth 环境变量 |
| `client/src/views/LoginView.vue` | 修改 | OAuth 优先布局 |
| `client/src/stores/appStore.ts` | 修改 | 新增 oauthLogin/setupOAuth 方法 |
| `.env` | 修改 | 新增 OAuth 配置项 |

## 不在范围内

- 多用户系统 / RBAC
- 微信登录落地（需公网域名，仅留骨架）
- 密码修改 / 密码找回
- Token 自动刷新
