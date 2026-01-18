import { handleAuthenticationFailure } from './authUtils';

// API 基础地址
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.dailys.zone/v1';

export interface IdentityMe {
  user_id: string;
  role: 'default' | 'preview' | 'vip' | 'admin';
  nickname: string | null;
  is_admin: boolean;
  is_vip: boolean;
  is_preview: boolean;
  has_elevated_access: boolean;
}

export interface UserRole {
  id: number;
  logto_user_id: string;
  role: 'default' | 'preview' | 'vip' | 'admin';
  nickname: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleStats {
  default: number;
  preview: number;
  vip: number;
  admin: number;
  total: number;
}

export interface UserRoleListResponse {
  items: UserRole[];
  total: number;
  limit: number;
  offset: number;
}

export class IdentityApiService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      handleAuthenticationFailure();
      throw new Error('Authentication failed');
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('Invalid response format');
    }

    const data: T = await response.json();

    if (!response.ok) {
      const errorDetails = (data as { detail?: string } | undefined)?.detail;
      throw new Error(errorDetails || `API error: ${response.status}`);
    }

    return data;
  }

  async getIdentity(): Promise<IdentityMe> {
    return this.request<IdentityMe>('/identity/me');
  }

  async checkRole(role: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/identity/check-role/${role}`,
    );
  }

  async getUserStats(): Promise<UserRoleStats> {
    return this.request<UserRoleStats>('/identity/admin/users/stats');
  }

  async listUsers(params?: {
    role?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserRoleListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.role) queryParams.append('role', params.role);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request<UserRoleListResponse>(
      `/identity/admin/users${query ? `?${query}` : ''}`,
    );
  }

  async getUser(logtoUserId: string): Promise<UserRole> {
    return this.request<UserRole>(`/identity/admin/users/${logtoUserId}`);
  }

  async setUserRole(data: {
    logto_user_id: string;
    role: string;
    nickname?: string;
    remark?: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      '/identity/admin/users',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  }

  async updateUserRole(
    logtoUserId: string,
    data: {
      role?: string;
      nickname?: string;
      remark?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/identity/admin/users/${logtoUserId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    );
  }

  async deleteUserRole(logtoUserId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/identity/admin/users/${logtoUserId}`,
      {
        method: 'DELETE',
      },
    );
  }
}
