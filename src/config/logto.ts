import type { LogtoConfig } from '@logto/react'
import { UserScope } from '@logto/react'

const parseResources = (): string[] => {
  const resourcesEnv = import.meta.env.VITE_LOGTO_RESOURCES;
  if (!resourcesEnv || resourcesEnv.trim() === '') {
    return [];
  }
  return resourcesEnv.split(',').map((r: string) => r.trim()).filter(Boolean);
};

// Logto 配置 - 请根据你的自部署 Logto 实例修改这些值
export const logtoConfig: LogtoConfig = {
  // Logto 服务端点 (自部署地址)
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT || 'https://your-logto-instance.com',
  // 应用 ID (在 Logto 控制台创建应用后获取)
  appId: import.meta.env.VITE_LOGTO_APP_ID || 'your-app-id',
  // 资源标识符 (可选，用于 API 认证)
  resources: parseResources(),
  scopes: [
    'openid',
    'profile',
    UserScope.Email,
    UserScope.Phone,
    UserScope.Profile,
    UserScope.Identities,
  ],
};

// 获取 Logto API 地址
export const getLogtoApiBase = (): string => {
  const endpoint = import.meta.env.VITE_LOGTO_ENDPOINT || 'https://your-logto-instance.com';
  // 确保 endpoint 不以斜杠结尾，避免双斜杠问题
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  return `${cleanEndpoint}/api`;
};

// 回调 URL 配置
export const redirectUri = `${window.location.origin}/callback`;
export const postSignOutRedirectUri = `${window.location.origin}/signin`;
