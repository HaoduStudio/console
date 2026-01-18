/**
 * 认证工具模块
 * 处理 Token 失效时的自动退出登录和重定向
 */

import { postSignOutRedirectUri } from '../config/logto';

// 认证错误类型
export interface AuthError {
  statusCode: number;
  message: string;
  code?: string;
}

// 检查是否为认证错误（401 未授权）
export function isAuthenticationError(statusCode: number): boolean {
  return statusCode === 401;
}

// 检查错误是否为 Token 相关错误
export function isTokenError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('token') ||
      message.includes('401') ||
      message.includes('authentication') ||
      message.includes('invalid_token') ||
      message.includes('expired')
    );
  }
  return false;
}

// 获取存储的 Logto 客户端实例的 signOut 方法
let signOutHandler: (() => Promise<void>) | null = null;

// 注册退出登录处理函数
export function registerSignOutHandler(handler: () => Promise<void>): void {
  signOutHandler = handler;
}

// 清除本地存储的登录态
export function clearLocalAuthState(): void {
  // 清除所有 Logto 相关的本地存储
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('logto') || key.includes('logto'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => { localStorage.removeItem(key); });
  
  // 清除 sessionStorage
  const sessionKeysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith('logto') || key.includes('logto'))) {
      sessionKeysToRemove.push(key);
    }
  }
  sessionKeysToRemove.forEach(key => { sessionStorage.removeItem(key); });
}

// 处理认证失败 - 退出登录并重定向到登录页
export async function handleAuthenticationFailure(reason?: string): Promise<never> {
  console.warn('认证失败，正在清除登录态...', reason ? `原因: ${reason}` : '');
  
  // 清除本地存储的认证状态
  clearLocalAuthState();
  
  // 如果有注册的 signOut 处理函数，尝试调用
  if (signOutHandler) {
    try {
      await signOutHandler();
    } catch (error) {
      console.error('调用 signOut 失败:', error);
    }
  }
  
  // 重定向到登录页面
  window.location.href = postSignOutRedirectUri;
  
  // 抛出错误以中断后续执行
  throw new Error('认证已失效，正在重定向到登录页面');
}

// 包装 API 请求的错误处理
export async function withAuthErrorHandling<T>(
  request: () => Promise<T>,
  options?: {
    onAuthError?: () => void;
    skipAutoRedirect?: boolean;
  }
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    // 检查是否为认证错误
    if (error instanceof Response && error.status === 401) {
      if (!options?.skipAutoRedirect) {
        await handleAuthenticationFailure('API 返回 401 未授权');
      }
      options?.onAuthError?.();
    }
    
    // 检查是否为包含状态码的错误对象
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as AuthError;
      if (isAuthenticationError(authError.statusCode)) {
        if (!options?.skipAutoRedirect) {
          await handleAuthenticationFailure(authError.message);
        }
        options?.onAuthError?.();
      }
    }
    
    // 检查错误消息是否表明 Token 问题
    if (isTokenError(error)) {
      if (!options?.skipAutoRedirect) {
        await handleAuthenticationFailure(
          error instanceof Error ? error.message : 'Token 错误'
        );
      }
      options?.onAuthError?.();
    }
    
    throw error;
  }
}

// 创建带认证错误处理的 fetch 包装器
export function createAuthenticatedFetch(
  originalFetch: typeof fetch = fetch
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    
    if (response.status === 401) {
      // 克隆响应以便读取内容
      const clonedResponse = response.clone();
      try {
        const errorData = await clonedResponse.json();
        await handleAuthenticationFailure(
          errorData.message || errorData.error || 'Token 无效或已过期'
        );
      } catch {
        await handleAuthenticationFailure('Token 无效或已过期');
      }
    }
    
    return response;
  };
}
