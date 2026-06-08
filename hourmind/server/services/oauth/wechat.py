# server/services/oauth/wechat.py
# 微信开放平台 OAuth Provider —— 骨架代码，公网域名就绪后完善
# 微信 OAuth 文档: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
from config import WECHAT_APP_ID, WECHAT_APP_SECRET
from services.oauth.base import OAuthProvider

WECHAT_AUTHORIZE_URL = "https://open.weixin.qq.com/connect/qrconnect"   # 微信扫码授权页
WECHAT_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token"  # Token 换取
WECHAT_USER_URL = "https://api.weixin.qq.com/sns/userinfo"              # 用户信息


class WechatProvider(OAuthProvider):
    """微信开放平台 OAuth Provider——需公网域名 + 备案 + AppID，当前为桩代码"""

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
        """微信扫码授权 URL——当前为桩代码，公网部署 + AppID 就绪后实现"""
        raise NotImplementedError("微信登录需公网域名 + 备案，尚未启用")

    def exchange_code(self, code: str) -> dict:
        """用 code 换 access_token——当前为桩代码"""
        raise NotImplementedError("微信登录需公网域名 + 备案，尚未启用")

    def get_user_info(self, access_token: str) -> dict:
        """获取微信用户信息——当前为桩代码"""
        raise NotImplementedError("微信登录需公网域名 + 备案，尚未启用")
