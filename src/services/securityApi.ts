/**
 * 安全 API 服务
 * 
 * 保留 API_ENDPOINT 配置以备后续使用（如云同步等功能）
 */
import { handleAuthenticationFailure, isAuthenticationError } from './authUtils';

const getApiBase = (): string => {
  const base = import.meta.env.VITE_API_BASE || '';
  return base.replace(/\/+$/, '');
};

/**
 * 检查后端 API 是否已配置
 */
export const isSecurityApiEnabled = (): boolean => {
  return !!getApiBase();
};

export interface SecurityApiErrorInfo {
  message: string;
  statusCode?: number;
  code?: string;
}

export function createSecurityApiError(
  message: string,
  statusCode?: number,
  code?: string
): Error & SecurityApiErrorInfo {
  const error = new Error(message) as Error & SecurityApiErrorInfo;
  error.name = 'SecurityApiError';
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/**
 * 通用安全请求方法
 * 用于后续扩展功能（如云同步等）
 */
export async function securityRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw createSecurityApiError('后端 API 未配置，请设置 VITE_API_BASE 环境变量');
  }

  const url = `${apiBase}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // 解析错误消息（支持多种格式）
    let errorMessage = '';
    let errorCode = '';
    
    if (data.detail) {
      if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (typeof data.detail === 'object') {
        errorMessage = data.detail.message || JSON.stringify(data.detail);
        errorCode = data.detail.code || '';
      }
    } else {
      errorMessage = data.message || data.error || `请求失败: ${response.status}`;
      errorCode = data.code || '';
    }

    // 检查是否为 scope/credentials 相关的错误（不应该触发登录重定向）
    const isScopeError = errorCode === 'auth.unauthorized' || 
      errorMessage.toLowerCase().includes('scope') ||
      errorMessage.toLowerCase().includes('credentials');

    // 检查是否为 Token 失效错误（应该触发登录重定向）
    const isTokenExpiredError = 
      errorMessage.toLowerCase().includes('token') &&
      (errorMessage.toLowerCase().includes('expired') || 
       errorMessage.toLowerCase().includes('invalid'));

    // 只有 token 过期/无效错误才触发登录重定向，scope 错误不触发
    if (isAuthenticationError(response.status) && isTokenExpiredError && !isScopeError) {
      await handleAuthenticationFailure(errorMessage);
    }
    
    throw createSecurityApiError(errorMessage, response.status, errorCode);
  }

  return data as T;
}

export const SecurityApiService = {
  isEnabled: isSecurityApiEnabled,
  request: securityRequest,
};
