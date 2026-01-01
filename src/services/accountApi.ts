import { getLogtoApiBase } from '../config/logto';

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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
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

  async verifyPassword(password: string): Promise<VerificationRecordResponse> {
    return this.request<VerificationRecordResponse>('/verifications/password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
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
