import { getLogtoApiBase } from '../config/logto';
import { handleAuthenticationFailure, isAuthenticationError } from './authUtils';

export interface AccountInfo {
  id: string;
  username?: string;
  name?: string;
  avatar?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  hasPassword?: boolean;
  profile?: {
    familyName?: string;
    givenName?: string;
    nickname?: string;
    gender?: string;
    birthdate?: string;
  };
}

export interface VerificationRecordResponse {
  verificationRecordId: string;
  expiresAt: string;
}

export interface VerificationCodeResponse {
  verificationRecordId: string;
  expiresAt: string;
}

export class AccountApiService {
  private accessToken: string;
  private apiBase: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.apiBase = getLogtoApiBase();
  }

  /**
   * 获取当前 access token
   * 用于传递给后端安全 API
   */
  getAccessToken(): string {
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    queryParams?: Record<string, string>
  ): Promise<T> {
    let url = `${this.apiBase}${endpoint}`;
    
    // 添加查询参数（用于 ESA 验签等场景）
    if (queryParams && Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams(queryParams);
      url = `${url}?${searchParams.toString()}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // 检查是否为认证错误（401 未授权）
      if (isAuthenticationError(response.status)) {
        const errorData = await response.json().catch(() => ({}));
        await handleAuthenticationFailure(
          errorData.message || 'Token 无效或已过期，请重新登录'
        );
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `请求失败: ${response.status}`);
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text);
  }

  async getAccountInfo(): Promise<AccountInfo> {
    return this.request<AccountInfo>('/my-account');
  }

  async updateAccountInfo(data: {
    username?: string;
    name?: string;
    avatar?: string;
  }): Promise<void> {
    await this.request('/my-account', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateProfile(data: {
    familyName?: string;
    givenName?: string;
    nickname?: string;
    gender?: string;
    birthdate?: string;
  }): Promise<void> {
    await this.request('/my-account/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * 验证密码，获取 verificationRecordId
   * 用于敏感操作前的身份验证
   * @param password 当前密码
   * @param captchaVerifyParam ESA 验证码验签参数（可选，开启验证码时必传）
   */
  async verifyPassword(
    password: string,
    captchaVerifyParam?: string
  ): Promise<VerificationRecordResponse> {
    // 构建 ESA 验签的查询参数和 Header
    const queryParams: Record<string, string> = {};
    const headers: Record<string, string> = {};
    
    if (captchaVerifyParam) {
      // ESA 验签需要同时通过 URI 参数和 Header 传递
      queryParams['captcha_verify_param'] = captchaVerifyParam;
      headers['captcha-Verify-param'] = captchaVerifyParam;
    }
    
    return this.request<VerificationRecordResponse>(
      '/verifications/password',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ password }),
      },
      queryParams
    );
  }

  async sendVerificationCode(
    type: 'email' | 'phone',
    value: string
  ): Promise<VerificationCodeResponse> {
    return this.request<VerificationCodeResponse>('/verifications/verification-code', {
      method: 'POST',
      body: JSON.stringify({
        identifier: { type, value },
        templateType: 'UserPermissionValidation',
      }),
    });
  }

  async verifyCode(
    type: 'email' | 'phone',
    value: string,
    verificationId: string,
    code: string
  ): Promise<VerificationRecordResponse> {
    return this.request<VerificationRecordResponse>('/verifications/verification-code/verify', {
      method: 'POST',
      body: JSON.stringify({
        identifier: { type, value },
        verificationId,
        code,
      }),
    });
  }

  async updatePassword(
    newPassword: string,
    verificationRecordId: string
  ): Promise<void> {
    await this.request('/my-account/password', {
      method: 'POST',
      headers: {
        'logto-verification-id': verificationRecordId,
      },
      body: JSON.stringify({ password: newPassword }),
    });
  }

  async updatePrimaryEmail(
    email: string,
    newIdentifierVerificationRecordId: string,
    verificationRecordId: string
  ): Promise<void> {
    await this.request('/my-account/primary-email', {
      method: 'POST',
      headers: {
        'logto-verification-id': verificationRecordId,
      },
      body: JSON.stringify({
        email,
        newIdentifierVerificationRecordId,
      }),
    });
  }

  async deletePrimaryEmail(verificationRecordId: string): Promise<void> {
    await this.request('/my-account/primary-email', {
      method: 'DELETE',
      headers: {
        'logto-verification-id': verificationRecordId,
      },
    });
  }

  async updatePrimaryPhone(
    phone: string,
    newIdentifierVerificationRecordId: string,
    verificationRecordId: string
  ): Promise<void> {
    await this.request('/my-account/primary-phone', {
      method: 'POST',
      headers: {
        'logto-verification-id': verificationRecordId,
      },
      body: JSON.stringify({
        phone,
        newIdentifierVerificationRecordId,
      }),
    });
  }

  async deletePrimaryPhone(verificationRecordId: string): Promise<void> {
    await this.request('/my-account/primary-phone', {
      method: 'DELETE',
      headers: {
        'logto-verification-id': verificationRecordId,
      },
    });
  }
}
