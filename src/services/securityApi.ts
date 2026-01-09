import { handleAuthenticationFailure, isAuthenticationError } from './authUtils';

const getApiBase = (): string => {
  const base = import.meta.env.VITE_API_BASE || '';
  return base.replace(/\/+$/, '');
};

export const isSecurityApiEnabled = (): boolean => {
  return !!getApiBase();
};

export interface VerifyCaptchaRequest {
  captcha_verify_param: string;
  scene_id?: string;
}

export interface VerifyCaptchaResponse {
  success: boolean;
  verify_result: boolean;
  verify_code: string;
  certify_id: string;
  message: string;
}

export interface VerifyPasswordRequest {
  captcha_verify_param: string;
  captcha_scene_id?: string;
  password: string;
  access_token: string;
}

export interface VerifyPasswordResponse {
  verification_record_id: string;
  expires_at: string;
}

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

async function securityRequest<T>(
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
    // 检查是否为认证错误（401 未授权）- Token 失效
    if (isAuthenticationError(response.status)) {
      await handleAuthenticationFailure(
        data.message || data.error || 'Token 无效或已过期，请重新登录'
      );
    }
    
    throw createSecurityApiError(
      data.message || data.error || `请求失败: ${response.status}`,
      response.status,
      data.code
    );
  }

  return data as T;
}

export async function verifyCaptcha(
  captchaVerifyParam: string,
  sceneId?: string
): Promise<VerifyCaptchaResponse> {
  const body: VerifyCaptchaRequest = {
    captcha_verify_param: captchaVerifyParam,
  };
  
  if (sceneId) {
    body.scene_id = sceneId;
  }

  return securityRequest<VerifyCaptchaResponse>('/v1/security/verify_captcha', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function verifyPasswordWithCaptcha(
  captchaVerifyParam: string,
  password: string,
  accessToken: string,
  captchaSceneId?: string
): Promise<VerifyPasswordResponse> {
  // 调试日志：确认参数传递正确
  console.log('[securityApi] verifyPasswordWithCaptcha 参数:', {
    captchaVerifyParam: captchaVerifyParam ? captchaVerifyParam.substring(0, 20) + '...' : 'undefined/null',
    passwordLength: password?.length ?? 'undefined',
    accessTokenLength: accessToken?.length ?? 'undefined',
    captchaSceneId,
  });

  const body: VerifyPasswordRequest = {
    captcha_verify_param: captchaVerifyParam,
    password,
    access_token: accessToken,
  };
  
  if (captchaSceneId) {
    body.captcha_scene_id = captchaSceneId;
  }

  console.log('[securityApi] 请求体:', {
    captcha_verify_param: captchaVerifyParam ? 'exists' : 'missing',
    password: password ? '***' : 'missing',
    access_token: accessToken ? '***' : 'missing',
    captcha_scene_id: captchaSceneId,
  });

  return securityRequest<VerifyPasswordResponse>('/v1/security/verify_password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

export const SecurityApiService = {
  verifyCaptcha,
  verifyPassword: verifyPasswordWithCaptcha,
};
