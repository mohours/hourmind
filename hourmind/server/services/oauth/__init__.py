# server/services/oauth/__init__.py
# OAuth Provider 注册中心 —— 收集所有已实现的 Provider 实例
from typing import Optional
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


def get_provider(provider_id: str) -> Optional[OAuthProvider]:
    """根据 ID 查找 Provider，找不到返回 None"""
    for p in get_providers():
        if p.provider_id == provider_id:
            return p
    return None
