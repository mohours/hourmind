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
        """Provider 图标标识——前端根据此值渲染对应图标"""
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
