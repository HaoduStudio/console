import { handleAuthenticationFailure, isAuthenticationError } from './authUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.dailys.zone/v1';

export type QuotaSource = 'role_default' | 'sign_in' | 'redeem' | 'admin_grant';

export interface QuotaSegment {
  source: QuotaSource;
  size_kb: number;
  expires_at: string | null;
  note: string | null;
}

export interface CloudQuotaResponse {
  used_kb: number;
  available_kb: number;
  total_quota_kb: number;
  default_quota_kb: number;
  segments: QuotaSegment[];
}

export interface CheckInResponse {
  already_checked_in: boolean;
  reward_kb?: number;
  grant_expires_at?: string;
  available_kb: number;
  total_quota_kb: number;
  message: string;
}

export interface RedeemResponse {
  reward_kb: number;
  grant_expires_at: string;
  available_kb: number;
  total_quota_kb: number;
  message: string;
}

export interface RoleQuotaConfig {
  role: string;
  size_kb: number;
}

export interface RedeemCode {
  id: number;
  code: string;
  space_kb: number;
  code_expires_at: string | null;
  grant_expires_at: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateRedeemCodeParams {
  code: string;
  space_kb: number;
  code_expires_at?: string;
  grant_valid_days?: number;
  max_redemptions?: number;
}

export interface UserGrantParams {
  size_kb: number;
  expires_at?: string;
  note?: string;
}

export interface PaginatedResponse<T> {
  items?: T[];
  total?: number;
  limit?: number;
  offset?: number;
}

export const formatStorageSize = (kb: number): string => {
  if (kb < 1024) {
    return `${kb} KB`;
  } else if (kb < 1024 * 1024) {
    return `${(kb / 1024).toFixed(2)} MB`;
  } else {
    return `${(kb / 1024 / 1024).toFixed(2)} GB`;
  }
};

export const getQuotaSourceText = (source: QuotaSource): string => {
  const sourceMap: Record<QuotaSource, string> = {
    role_default: '角色基础',
    sign_in: '每日签到',
    redeem: '兑换码',
    admin_grant: '管理员操作',
  };
  return sourceMap[source] || source;
};

export const calculateUsagePercentage = (used: number, total: number): number => {
  if (total === 0) return 0;
  return Math.min(Math.round((used / total) * 100), 100);
};

export class CloudSpaceApiService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (isAuthenticationError(response.status)) {
        const errorData = await response.json().catch(() => ({}));
        await handleAuthenticationFailure(
          errorData.detail || 'Token 无效或已过期，请重新登录'
        );
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `请求失败: ${response.status}`);
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text);
  }


  async getQuota(): Promise<CloudQuotaResponse> {
    return this.request<CloudQuotaResponse>('/cloud-resource/quota');
  }

  async checkIn(): Promise<CheckInResponse> {
    return this.request<CheckInResponse>('/cloud-resource/check-in', {
      method: 'POST',
    });
  }

  async redeemCode(code: string): Promise<RedeemResponse> {
    return this.request<RedeemResponse>('/cloud-resource/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getRoleQuotaConfigs(): Promise<RoleQuotaConfig[]> {
    return this.request<RoleQuotaConfig[]>('/admin/cloud-space/role-config');
  }

  async setRoleQuotaConfig(role: string, sizeKb: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/admin/cloud-space/role-config/${role}`,
      {
        method: 'PUT',
        body: JSON.stringify({ size_kb: sizeKb }),
      }
    );
  }

  async grantUserQuota(
    logtoUserId: string,
    params: UserGrantParams
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/admin/cloud-space/users/${logtoUserId}/grants`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  async createRedeemCode(params: CreateRedeemCodeParams): Promise<RedeemCode> {
    return this.request<RedeemCode>('/admin/cloud-space/codes', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getRedeemCodes(params?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<RedeemCode> & { items: RedeemCode[] }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString();
    const endpoint = `/admin/cloud-space/codes${queryString ? `?${queryString}` : ''}`;

    return this.request<PaginatedResponse<RedeemCode> & { items: RedeemCode[] }>(endpoint);
  }

  async deleteRedeemCode(codeId: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/admin/cloud-space/codes/${codeId}`,
      { method: 'DELETE' }
    );
  }
  async toggleRedeemCodeStatus(codeId: number, isActive: boolean): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/admin/cloud-space/codes/${codeId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      }
    );
  }
}
