import type { LogtoConfig } from '@logto/react';

// Logto 配置 - 请根据你的自部署 Logto 实例修改这些值
export const logtoConfig: LogtoConfig = {
  // Logto 服务端点 (自部署地址)
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT || 'https://your-logto-instance.com',
  // 应用 ID (在 Logto 控制台创建应用后获取)
  appId: import.meta.env.VITE_LOGTO_APP_ID || 'your-app-id',
  // 资源标识符 (可选，用于 API 认证)
  resources: import.meta.env.VITE_LOGTO_RESOURCES?.split(',') || [],
  // 权限范围
  scopes: ['openid', 'profile', 'email'],
};

// 回调 URL 配置
export const redirectUri = `${window.location.origin}/callback`;
export const postSignOutRedirectUri = `${window.location.origin}/signin`;
