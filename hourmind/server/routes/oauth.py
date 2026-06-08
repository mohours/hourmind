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
