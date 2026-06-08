# server/services/oauth/github.py
# GitHub OAuth Provider —— 用 GitHub 账号登录 HourMind
# GitHub OAuth 文档: https://docs.github.com/en/apps/oauth-apps
import httpx
from config import GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI
from services.oauth.base import OAuthProvider

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"  # GitHub 授权页
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"   # Token 换取接口
GITHUB_USER_URL = "https://api.github.com/user"                    # 用户信息接口


class GitHubProvider(OAuthProvider):
    """GitHub OAuth Provider —— 实现授权 URL 生成、code 换 token、获取用户信息"""

    @property
    def provider_id(self) -> str:
        return "github"  # 唯一标识

    @property
    def provider_name(self) -> str:
        return "GitHub"  # 显示名称

    @property
    def provider_icon(self) -> str:
        return "github"  # 前端根据此值渲染 GitHub 图标

    def get_authorization_url(self, state: str) -> str:
        """构建 GitHub OAuth 授权 URL——scope 仅需 user:email 读邮箱和用户名"""
        params = {
            "client_id": GITHUB_CLIENT_ID,            # OAuth App 注册获取的 Client ID
            "redirect_uri": GITHUB_REDIRECT_URI,       # 授权后回调地址
            "scope": "user:email",                     # 读取用户名和邮箱
            "state": state,                            # CSRF 防护 token
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{GITHUB_AUTHORIZE_URL}?{query}"

    def exchange_code(self, code: str) -> dict:
        """用授权码向 GitHub 换取 access_token——同步调用，与现有 auth 路由风格一致"""
        headers = {"Accept": "application/json"}  # 要求返回 JSON 而非默认的 form-encoded
        data = {
            "client_id": GITHUB_CLIENT_ID,            # OAuth App ID
            "client_secret": GITHUB_CLIENT_SECRET,     # OAuth App Secret
            "code": code,                              # 一次性授权码
            "redirect_uri": GITHUB_REDIRECT_URI,       # 必须与授权时完全一致
        }
        # 用同步 httpx.Client（与现有 auth 路由 sync 风格保持一致）
        with httpx.Client() as client:
            resp = client.post(GITHUB_TOKEN_URL, headers=headers, data=data, timeout=15)
            resp.raise_for_status()  # 非 200 直接抛异常
            return resp.json()       # {access_token, token_type, scope}

    def get_user_info(self, access_token: str) -> dict:
        """用 access_token 获取 GitHub 用户信息——返回 id、username、avatar_url"""
        headers = {
            "Authorization": f"Bearer {access_token}",  # Bearer Token 认证
            "Accept": "application/json",
        }
        with httpx.Client() as client:
            resp = client.get(GITHUB_USER_URL, headers=headers, timeout=15)
            resp.raise_for_status()  # 非 200 直接抛异常
            user_data = resp.json()  # {id, login, avatar_url, email, ...}
            return {
                "id": str(user_data["id"]),                    # GitHub 用户 ID（统一转字符串）
                "username": user_data.get("login", ""),        # GitHub 用户名
                "avatar_url": user_data.get("avatar_url", ""),  # 头像 URL
            }
