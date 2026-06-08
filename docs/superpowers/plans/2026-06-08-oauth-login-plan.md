# OAuth 第三方登录系统 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有密码认证基础上新增可插拔 OAuth 第三方登录，优先接入 GitHub OAuth

**Architecture:** 策略模式 Provider 抽象层（base → github / wechat），后端新增 `/api/auth/oauth/*` 路由，前端登录页改为 OAuth 优先布局。单用户模型，首次 OAuth 登录自动绑定，密码登录保留为备选

**Tech Stack:** Python 3 + FastAPI + httpx (同步) + sqlite3 / Vue 3 + TypeScript + Pinia

---

### Task 1: 数据库 Schema — 新增 user_auth 表

**Files:**
- Modify: `hourmind/server/db/schema.sql`

- [ ] **Step 1: 在 schema.sql 末尾追加 user_auth 建表语句**

在文件末尾 `-- 知识库表` 的 CREATE TABLE 语句之后，追加：

```sql
-- 第三方登录绑定表（记录已绑定的 OAuth 账号）
CREATE TABLE IF NOT EXISTS user_auth (
    id               TEXT PRIMARY KEY,
    provider         TEXT NOT NULL,          -- 平台标识：github / wechat / google
    provider_user_id TEXT NOT NULL,          -- 第三方平台用户 ID
    provider_username TEXT,                  -- 第三方用户名（展示用）
    access_token     TEXT,                   -- AES-256-GCM 加密存储的 access_token
    created_at       TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, provider_user_id)
);
```

- [ ] **Step 2: 验证建表**

```bash
cd hourmind/server && python3 -c "
from database import init_db
init_db()
import sqlite3
from config import DATABASE_PATH
conn = sqlite3.connect(DATABASE_PATH)
tables = conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()
print([t['name'] for t in tables])
conn.close()
"
```

Expected: 输出包含 `user_auth`（现在应该是 8 张表）

- [ ] **Step 3: Commit**

```bash
git add hourmind/server/db/schema.sql
git commit -m "feat: 新增 user_auth 表支持 OAuth 第三方账号绑定

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: 配置层 — 加载 OAuth 环境变量

**Files:**
- Modify: `hourmind/server/config.py`

- [ ] **Step 1: 在 config.py 追加 OAuth 配置**

在现有 `PORT` 变量定义之后追加：

```python
# ── OAuth 第三方登录配置 ──
# GitHub OAuth（localhost 回调）
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/auth/oauth/github/callback")
# 微信开放平台（预留，需公网域名 + 备案）
WECHAT_APP_ID = os.getenv("WECHAT_APP_ID", "")
WECHAT_APP_SECRET = os.getenv("WECHAT_APP_SECRET", "")
```

- [ ] **Step 2: Commit**

```bash
git add hourmind/server/config.py
git commit -m "feat: config.py 新增 OAuth 环境变量加载

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: OAuth Provider 抽象基类

**Files:**
- Create: `hourmind/server/services/oauth/__init__.py`
- Create: `hourmind/server/services/oauth/base.py`

- [ ] **Step 1: 创建 `__init__.py`**

```python
# server/services/oauth/__init__.py
# OAuth Provider 注册中心 —— 收集所有已实现的 Provider
from services.oauth.base import OAuthProvider
from services.oauth.github import GitHubProvider
# 微信 Provider 预留（公网域名就绪后取消注释）
# from services.oauth.wechat import WechatProvider

def get_providers() -> list[OAuthProvider]:
    """返回所有已注册的 OAuth Provider 实例"""
    providers = [
        GitHubProvider(),
    ]
    # providers.append(WechatProvider())  # 预留
    return providers

def get_provider(provider_id: str) -> OAuthProvider | None:
    """根据 ID 查找 Provider，找不到返回 None"""
    for p in get_providers():
        if p.provider_id == provider_id:
            return p
    return None
```

- [ ] **Step 2: 创建抽象基类 `base.py`**

```python
# server/services/oauth/base.py
# OAuth Provider 抽象基类 —— 定义第三方登录的统一接口
from abc import ABC, abstractmethod

class OAuthProvider(ABC):
    """OAuth Provider 抽象基类——新增第三方登录只需继承此类并实现三个方法"""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Provider 唯一标识，如 github / wechat"""
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Provider 显示名称，如 GitHub / 微信"""
        ...

    @property
    @abstractmethod
    def provider_icon(self) -> str:
        """Provider 图标 URL 或 SVG data URI"""
        ...

    @abstractmethod
    def get_authorization_url(self, state: str) -> str:
        """生成第三方授权页 URL——用户跳转后完成授权"""
        ...

    @abstractmethod
    def exchange_code(self, code: str) -> dict:
        """用授权码换取 access_token——返回 {access_token, ...}"""
        ...

    @abstractmethod
    def get_user_info(self, access_token: str) -> dict:
        """用 access_token 获取用户信息——返回 {id, username, avatar_url}"""
        ...
```

- [ ] **Step 3: Commit**

```bash
git add hourmind/server/services/oauth/
git commit -m "feat: OAuth Provider 抽象基类 + 注册中心

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: GitHub OAuth Provider 实现

**Files:**
- Create: `hourmind/server/services/oauth/github.py`

- [ ] **Step 1: 实现 GitHubProvider**

```python
# server/services/oauth/github.py
# GitHub OAuth Provider —— 用 GitHub 账号登录 HourMind
import httpx
from config import GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI
from services.oauth.base import OAuthProvider

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"  # GitHub 授权页
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"   # Token 换取接口
GITHUB_USER_URL = "https://api.github.com/user"                    # 用户信息接口


class GitHubProvider(OAuthProvider):
    """GitHub OAuth Provider —— 文档: https://docs.github.com/en/apps/oauth-apps"""

    @property
    def provider_id(self) -> str:
        return "github"  # 唯一标识

    @property
    def provider_name(self) -> str:
        return "GitHub"  # 显示名称

    @property
    def provider_icon(self) -> str:
        # GitHub 猫头鹰图标 SVG（内联 data URI）
        return "github"  # 前端根据此值渲染对应图标

    def get_authorization_url(self, state: str) -> str:
        """构建 GitHub OAuth 授权 URL——scope 仅需 user:email 读邮箱"""
        params = {
            "client_id": GITHUB_CLIENT_ID,       # 注册的 OAuth App ID
            "redirect_uri": GITHUB_REDIRECT_URI,  # 授权后回调地址
            "scope": "user:email",                # 读取用户名和邮箱
            "state": state,                       # CSRF 防护 token
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{GITHUB_AUTHORIZE_URL}?{query}"

    def exchange_code(self, code: str) -> dict:
        """用授权码向 GitHub 换取 access_token"""
        headers = {"Accept": "application/json"}  # 要求返回 JSON
        data = {
            "client_id": GITHUB_CLIENT_ID,            # OAuth App ID
            "client_secret": GITHUB_CLIENT_SECRET,     # OAuth App Secret
            "code": code,                              # 授权码（一次性）
            "redirect_uri": GITHUB_REDIRECT_URI,       # 必须与授权时一致
        }
        # 用同步 httpx.Client 调用（与现有 auth 路由的同步风格一致）
        with httpx.Client() as client:
            resp = client.post(GITHUB_TOKEN_URL, headers=headers, data=data, timeout=15)
            resp.raise_for_status()  # 非 200 直接抛异常
            return resp.json()       # 返回 {access_token, token_type, scope}

    def get_user_info(self, access_token: str) -> dict:
        """用 access_token 获取 GitHub 用户信息"""
        headers = {
            "Authorization": f"Bearer {access_token}",  # Bearer Token 认证
            "Accept": "application/json",
        }
        with httpx.Client() as client:
            resp = client.get(GITHUB_USER_URL, headers=headers, timeout=15)
            resp.raise_for_status()  # 非 200 直接抛异常
            user_data = resp.json()  # 返回 {id, login, avatar_url, email, ...}
            return {
                "id": str(user_data["id"]),          # GitHub 用户 ID（统一转字符串）
                "username": user_data.get("login", ""),  # GitHub 用户名
                "avatar_url": user_data.get("avatar_url", ""),  # 头像 URL
            }
```

- [ ] **Step 2: Commit**

```bash
git add hourmind/server/services/oauth/github.py
git commit -m "feat: GitHub OAuth Provider 实现

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: OAuth 路由 — 授权/回调/解绑

**Files:**
- Create: `hourmind/server/routes/oauth.py`

- [ ] **Step 1: 创建 OAuth 路由文件**

```python
# server/routes/oauth.py
# OAuth 第三方登录路由 —— 授权 URL 生成、回调处理、账号绑定管理
import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from database import get_db
from auth import create_token, require_auth
from services.oauth import get_provider, get_providers
from services import crypto_service

router = APIRouter(prefix="/api/auth/oauth", tags=["oauth"])

# 内存存储 CSRF state token（单进程单用户，无需 Redis）
_state_store: dict[str, bool] = {}


def _generate_state() -> str:
    """生成随机 state 令牌并存入内存——用于回调时校验防 CSRF"""
    state = secrets.token_urlsafe(32)  # 32 字节随机 → 43 字符 URL 安全
    _state_store[state] = True
    return state


def _verify_state(state: str) -> bool:
    """校验 state 令牌——一次性消费，防止重放"""
    return _state_store.pop(state, None) is not None


@router.get("/providers")
def list_providers():
    """返回已启用的 OAuth 提供商列表——{id, name, icon}"""
    providers = get_providers()
    return {
        "providers": [
            {
                "id": p.provider_id,       # 平台标识
                "name": p.provider_name,   # 显示名称
                "icon": p.provider_icon,   # 图标标识
            }
            for p in providers
        ]
    }


@router.get("/{provider}/login")
def oauth_login(provider: str):
    """获取 OAuth 授权 URL——前端跳转到第三方授权页"""
    p = get_provider(provider)
    if not p:
        raise HTTPException(status_code=404, detail=f"不支持的登录方式: {provider}")

    state = _generate_state()  # 生成 CSRF 防护 token
    auth_url = p.get_authorization_url(state)
    return {"authorization_url": auth_url}


@router.get("/{provider}/callback")
def oauth_callback(provider: str, code: str, state: str):
    """OAuth 回调——用授权码换 token、获取用户信息、签发 JWT"""

    # 1. 校验 state 防 CSRF
    if not _verify_state(state):
        raise HTTPException(status_code=400, detail="无效的 state 参数，可能是 CSRF 攻击")

    # 2. 查找 Provider
    p = get_provider(provider)
    if not p:
        raise HTTPException(status_code=404, detail=f"不支持的登录方式: {provider}")

    # 3. 用授权码换取 access_token
    try:
        token_data = p.exchange_code(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="换取 access_token 失败")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"第三方授权失败: {str(e)}")

    # 4. 获取第三方用户信息
    try:
        user_info = p.get_user_info(access_token)
        provider_user_id = user_info["id"]
        provider_username = user_info.get("username", "")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"获取用户信息失败: {str(e)}")

    # 5. 查找或创建绑定记录
    db = get_db()
    try:
        existing = db.execute(
            "SELECT id FROM user_auth WHERE provider = ? AND provider_user_id = ?",
            (provider, provider_user_id)
        ).fetchone()

        if existing:
            # 已绑定 → 更新 access_token 和用户名
            encrypted_token = crypto_service.encrypt(access_token)
            db.execute(
                "UPDATE user_auth SET access_token = ?, provider_username = ? WHERE id = ?",
                (encrypted_token, provider_username, existing["id"]),
            )
        else:
            # 未绑定 → 检查是否首次使用（user_auth 表为空则允许自动绑定）
            any_existing = db.execute("SELECT COUNT(*) as cnt FROM user_auth").fetchone()
            if any_existing["cnt"] > 0:
                db.close()
                raise HTTPException(
                    status_code=403,
                    detail="该账号未绑定。请先用密码登录后在设置中绑定。"
                )

            # 首次使用，自动绑定
            encrypted_token = crypto_service.encrypt(access_token)
            auth_id = str(uuid.uuid4())
            db.execute(
                """INSERT INTO user_auth (id, provider, provider_user_id, provider_username, access_token)
                   VALUES (?, ?, ?, ?, ?)""",
                (auth_id, provider, provider_user_id, provider_username, encrypted_token),
            )

        db.commit()
    finally:
        db.close()

    # 6. 签发 JWT → 重定向回前端首页
    jwt_token = create_token()
    # 前端 hash 路由: /#/?token=xxx，hash 模式下 query 在 # 后面
    frontend_url = f"http://localhost:5173/#/?token={jwt_token}"
    return RedirectResponse(url=frontend_url, status_code=302)


@router.post("/{provider}/unlink")
def oauth_unlink(provider: str, payload: dict = Depends(require_auth)):
    """解绑第三方账号——需要已认证"""
    db = get_db()
    try:
        result = db.execute(
            "DELETE FROM user_auth WHERE provider = ?", (provider,)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"未绑定 {provider} 账号")
        db.commit()
        return {"ok": True, "message": f"已解绑 {provider} 账号"}
    finally:
        db.close()
```

- [ ] **Step 2: Commit**

```bash
git add hourmind/server/routes/oauth.py
git commit -m "feat: OAuth 路由——授权/回调/解绑完整流程

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: 注册 OAuth 路由到 main.py

**Files:**
- Modify: `hourmind/server/main.py`

- [ ] **Step 1: 在 main.py 中添加 OAuth 路由注册**

在现有路由注册区域（`# 注册聊天 WebSocket 路由` 之后）追加：

```python
# 注册 OAuth 第三方登录路由
from routes.oauth import router as oauth_router
app.include_router(oauth_router)
```

- [ ] **Step 2: 启动后端验证路由已注册**

启动后端，检查 `/api/auth/oauth/providers` 接口是否能访问：

```bash
cd hourmind/server && python main.py &
sleep 3
curl -s http://localhost:8000/api/auth/oauth/providers | python3 -m json.tool
kill %1 2>/dev/null
```

Expected:
```json
{
    "providers": [
        {"id": "github", "name": "GitHub", "icon": "github"}
    ]
}
```

- [ ] **Step 3: Commit**

```bash
git add hourmind/server/main.py
git commit -m "feat: main.py 注册 OAuth 路由

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: 前端 Store — 新增 OAuth 相关方法

**Files:**
- Modify: `hourmind/client/src/stores/appStore.ts`

- [ ] **Step 1: 在 appStore.ts 中新增 OAuth 相关方法**

在现有 `logout` 函数之后，追加以下代码：

```typescript
/** 获取已启用的 OAuth 提供商列表 */
async function getOAuthProviders() {
  const res = await fetch('/api/auth/oauth/providers')
  const data = await res.json()
  return data.providers || []  // [{id, name, icon}, ...]
}

/** 获取 OAuth 授权 URL */
async function getOAuthLoginUrl(provider: string) {
  const res = await fetch(`/api/auth/oauth/${provider}/login`)
  const data = await res.json()
  return data.authorization_url  // 返回跳转 URL 字符串
}

/** 处理 OAuth 回调 token——从 URL 中提取 token 并保存 */
function handleOAuthToken(token: string) {
  token.value = token
  localStorage.setItem('hourmind_token', token)
  isAuthenticated.value = true
  isSetupRequired.value = false
}
```

- [ ] **Step 2: 导出新增方法**

修改 `return` 语句，追加三个新方法：

```typescript
return { token, isAuthenticated, isSetupRequired, checkAuth, setup, login, logout,
         getOAuthProviders, getOAuthLoginUrl, handleOAuthToken }
```

- [ ] **Step 3: Commit**

```bash
git add hourmind/client/src/stores/appStore.ts
git commit -m "feat: appStore 新增 OAuth 相关方法

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: 前端登录页 — OAuth 优先布局

**Files:**
- Modify: `hourmind/client/src/views/LoginView.vue`

- [ ] **Step 1: 重写 LoginView.vue 模板**

将 `<template>` 和 `<script setup>` 完整替换为 OAuth 优先布局：

```vue
<!-- client/src/views/LoginView.vue -->
<!-- 登录页面 —— OAuth 优先，密码为备选 -->
<template>
  <div class="auth-container">
    <!-- 品牌标题 -->
    <h1 class="auth-title">HourMind</h1>
    <p class="auth-subtitle">小时智脑</p>

    <!-- 玻璃态表单卡片 -->
    <div class="glass-card" style="width: 400px; padding: 40px 36px">

      <!-- GitHub OAuth 登录按钮（主要入口） -->
      <button
        v-for="p in providers"
        :key="p.id"
        class="btn-oauth"
        :disabled="oauthLoading"
        @click="handleOAuthLogin(p.id)"
      >
        <!-- GitHub 猫头鹰图标 -->
        <svg v-if="p.id === 'github'" class="oauth-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        <span>{{ oauthLoading ? '正在跳转...' : `使用 ${p.name} 登录` }}</span>
      </button>

      <!-- 分隔线 -->
      <div class="divider">
        <span class="divider-text">或</span>
      </div>

      <!-- 密码登录（默认折叠） -->
      <button v-if="!showPassword" class="btn-link" @click="showPassword = true">
        使用密码登录
      </button>

      <template v-if="showPassword">
        <!-- 密码输入 -->
        <input
          v-model="password"
          type="password"
          placeholder="请输入主密码"
          class="auth-input"
          @keyup.enter="handleLogin"
        />
        <!-- 错误提示 -->
        <p v-if="error" class="error-text">{{ error }}</p>
        <!-- 登录按钮 -->
        <button
          class="btn-primary"
          style="width: 100%; margin-top: 8px"
          :disabled="loading"
          @click="handleLogin"
        >
          {{ loading ? '验证中...' : '密码登录' }}
        </button>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 重写 `<script setup>` 逻辑**

```typescript
<script setup lang="ts">
// LoginView 逻辑 —— OAuth 优先 + 密码备选
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const appStore = useAppStore()

// OAuth 相关状态
const providers = ref<Array<{id: string; name: string; icon: string}>>([])  // 可用 Provider 列表
const oauthLoading = ref(false)  // OAuth 跳转加载状态
// 密码登录相关状态
const showPassword = ref(false)  // 是否展开密码登录
const password = ref('')
const error = ref('')
const loading = ref(false)

// 页面加载时获取可用 Provider 列表
onMounted(async () => {
  try {
    providers.value = await appStore.getOAuthProviders()
  } catch {
    // 后端不可用时忽略，用户仍可通过密码登录
  }
})

/** OAuth 登录——获取授权 URL 后跳转 */
async function handleOAuthLogin(providerId: string) {
  oauthLoading.value = true
  try {
    const url = await appStore.getOAuthLoginUrl(providerId)
    window.location.href = url  // 跳转到 GitHub 授权页
  } catch {
    oauthLoading.value = false
    error.value = '获取授权链接失败，请检查后端是否已启动'
  }
}

/** 密码登录 */
async function handleLogin() {
  error.value = ''
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  try {
    const res = await appStore.login(password.value)
    if (res.token) {
      router.replace('/')
    } else if (res.detail) {
      error.value = res.detail
    }
  } catch {
    error.value = '网络错误，请检查后端是否已启动'
  } finally {
    loading.value = false
  }
}
</script>
```

- [ ] **Step 3: 在 App.vue 的 `<style>` 或全局 `style.css` 中追加 OAuth 按钮样式**

由于 `LoginView.vue` 没有 `<style scoped>` 块（样式在 `style.css` 全局定义），需要在 `client/src/style.css` 中 `.auth-input:focus` 样式之后追加：

```css
/* OAuth 第三方登录按钮 —— 深色玻璃态 + 图标左对齐 */
.btn-oauth {
  width: 100%;
  padding: 14px 24px;
  margin-bottom: 16px;
  background: rgba(36, 38, 45, 0.8);  /* 深灰玻璃底 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);  /* 玻璃模糊 */
}

/* OAuth 按钮悬浮辉光 */
.btn-oauth:hover {
  background: rgba(46, 48, 55, 0.9);
  border-color: rgba(255, 255, 255, 0.25);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.08);  /* 白色辉光 */
  transform: translateY(-1px);  /* 微上浮 */
}

.btn-oauth:active {
  transform: scale(0.98);  /* 弹性缩放 */
}

.btn-oauth:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* OAuth 图标尺寸 */
.oauth-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;  /* 不缩小 */
}

/* 分隔线 —— "或" */
.divider {
  display: flex;
  align-items: center;
  margin: 20px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);  /* 半透明白线 */
}

.divider-text {
  padding: 0 16px;
}

/* 链接式按钮 —— 展开密码登录 */
.btn-link {
  width: 100%;
  padding: 12px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.2s;
  text-align: center;  /* 居中 */
}

.btn-link:hover {
  color: var(--color-primary);  /* 悬浮变青 */
}
```

- [ ] **Step 4: Commit**

```bash
git add hourmind/client/src/views/LoginView.vue hourmind/client/src/style.css
git commit -m "feat: 登录页改为 OAuth 优先布局，密码登录折叠为备选

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: 前端 App.vue — 处理 OAuth 回调 token

**Files:**
- Modify: `hourmind/client/src/App.vue`

- [ ] **Step 1: 在 `onMounted` 的 `checkAuth()` 之前添加 OAuth token 检测**

修改 `onMounted` 回调，在调用 `store.checkAuth()` 之前检测 URL 中的 `?token=` 参数：

```typescript
// 页面加载时检查 token 有效性
onMounted(async () => {
  // 检测 OAuth 回调参数 —— URL 中有 ?token=xxx 则直接保存
  const urlParams = new URLSearchParams(window.location.hash.slice(1).split('?')[1])
  const oauthToken = urlParams.get('token')
  if (oauthToken) {
    store.handleOAuthToken(oauthToken)
    // 清理 URL 中的 token 参数（不留痕迹）
    window.location.hash = '#/'
    return
  }

  await store.checkAuth()

  // 请求通知权限 + 启动提醒（仅已认证时）
  if (store.isAuthenticated) {
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    checkReminders()  // 立即检查一次
    reminderTimer = window.setInterval(checkReminders, 30000)  // 每 30 秒
  }
})
```

注意：需要修改现有的 `onMounted` 实现——将 OAuth token 检测逻辑插入到 `await store.checkAuth()` 之前。完整替换 `onMounted` 回调体（原代码第 73-84 行）。

- [ ] **Step 2: Commit**

```bash
git add hourmind/client/src/App.vue
git commit -m "feat: App.vue 检测 OAuth 回调 token 并自动登录

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: 微信 Provider 骨架（预留）

**Files:**
- Create: `hourmind/server/services/oauth/wechat.py`

- [ ] **Step 1: 创建微信 Provider 骨架**

```python
# server/services/oauth/wechat.py
# 微信开放平台 OAuth Provider —— 骨架代码，公网域名就绪后完善
# 微信 OAuth 文档: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
from config import WECHAT_APP_ID, WECHAT_APP_SECRET
from services.oauth.base import OAuthProvider

WECHAT_AUTHORIZE_URL = "https://open.weixin.qq.com/connect/qrconnect"  # 微信扫码授权页
WECHAT_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token"  # Token 换取
WECHAT_USER_URL = "https://api.weixin.qq.com/sns/userinfo"              # 用户信息


class WechatProvider(OAuthProvider):
    """微信开放平台 OAuth Provider——需公网域名 + 备案 + AppID"""

    @property
    def provider_id(self) -> str:
        return "wechat"  # 唯一标识

    @property
    def provider_name(self) -> str:
        return "微信"  # 显示名称

    @property
    def provider_icon(self) -> str:
        return "wechat"  # 前端根据此值渲染微信图标

    def get_authorization_url(self, state: str) -> str:
        """微信扫码授权 URL——当前为桩代码"""
        # TODO: 微信开放平台 AppID 就绪后实现
        raise NotImplementedError("微信登录需公网域名 + 备案，尚未启用")

    def exchange_code(self, code: str) -> dict:
        """用 code 换 access_token——当前为桩代码"""
        raise NotImplementedError("微信登录需公网域名 + 备案，尚未启用")

    def get_user_info(self, access_token: str) -> dict:
        """获取微信用户信息——当前为桩代码"""
        raise NotImplementedError("微信登录需公网域名 + 备案，尚未启用")
```

- [ ] **Step 2: Commit**

```bash
git add hourmind/server/services/oauth/wechat.py
git commit -m "feat: 微信 OAuth Provider 骨架（公网域名就绪后启用）

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: 端到端验证

- [ ] **Step 1: 启动后端验证 OAuth 接口**

```bash
cd hourmind/server && python main.py &
sleep 3

# 验证 Provider 列表接口
echo "=== Provider 列表 ==="
curl -s http://localhost:8000/api/auth/oauth/providers | python3 -m json.tool

# 验证登录接口返回授权 URL
echo "=== GitHub 授权 URL ==="
curl -s http://localhost:8000/api/auth/oauth/github/login | python3 -m json.tool

kill %1 2>/dev/null
```

Expected:
```json
// providers
{"providers": [{"id": "github", "name": "GitHub", "icon": "github"}]}

// login
{"authorization_url": "https://github.com/login/oauth/authorize?client_id=..."}
```

- [ ] **Step 2: 启动前端验证登录页渲染**

```bash
cd hourmind/client && npm run dev &
sleep 5

# 用 Playwright 或手动验证登录页包含 GitHub 按钮
```

检查登录页：
- GitHub 登录按钮是否显示
- "或"分隔线是否渲染
- "使用密码登录"链接点击后是否展开密码输入
- 整体 UI 是否符合 Quantum Glass 风格

- [ ] **Step 3: 前端类型检查**

```bash
cd hourmind/client && npx vue-tsc -b --noEmit
```

Expected: 无类型错误

- [ ] **Step 4: Commit（如有修正）**

```bash
git add -A
git commit -m "fix: 端到端验证后的问题修复

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 实施顺序

```
Task 1 (schema) ──→ Task 2 (config) ──→ Task 3 (base) ──→ Task 4 (github provider)
                                                                    ↓
                                              Task 5 (routes) ←──────┘
                                                    ↓
                                              Task 6 (main.py 注册)
                                                    ↓
                    ┌───────────────────────────────┴───────────────────────────────┐
                    ↓                                                               ↓
              Task 7 (store) ──→ Task 8 (login page) ──→ Task 9 (App.vue)     Task 10 (wechat 骨架)
                    └───────────────────────────────┬───────────────────────────────┘
                                                    ↓
                                              Task 11 (E2E 验证)
```

## Git 分支管理

每 2-3 个 Task 完成后推送一次，避免大量提交堆积。前端和后端可并行开发的部分（Task 7-9 和 Task 10）可以分开做。

## 注意事项

1. **GitHub OAuth App 注册**：实现前需在 GitHub Settings → Developer settings → OAuth Apps 创建应用，获取 `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`，回调 URL 设为 `http://localhost:8000/api/auth/oauth/github/callback`
2. **state 存储**：当前用内存 dict 存储，服务重启后失效。单用户 localhost 场景足够，生产环境需换 Redis
3. **OAuth 回调端口**：GitHub 回调走的是 `localhost:8000`（后端），再由后端 302 重定向到 `localhost:5173`（前端）
4. **首次绑定逻辑**：`user_auth` 表为空时，任意 GitHub 账号都能登入并自动绑定；已绑定后，只有已绑定的账号才能登入
