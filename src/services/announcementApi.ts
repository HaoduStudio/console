import { handleAuthenticationFailure, isAuthenticationError } from './authUtils';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.dailys.zone/v1';
export type AnnouncementType = 'update' | 'warning' | 'rce' | 'notice';
export type UserRoleType = 'default' | 'preview' | 'vip' | 'admin';

export interface Announcement {
  id: number;
  title: string;
  content: string;
  announcement_type: AnnouncementType;
  target_roles: UserRoleType[] | null;
  target_users: string[] | null;
  is_popup: boolean;
  require_confirm: boolean;
  is_active: boolean;
  priority: number;
  start_time: string | null;
  end_time: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserAnnouncement {
  id: number;
  title: string;
  content: string;
  announcement_type: AnnouncementType;
  is_popup: boolean;
  require_confirm: boolean;
  priority: number;
  created_at: string;
}

export interface UnreadAnnouncementsResponse {
  items: UserAnnouncement[];
  total: number;
  has_popup: boolean;
  has_require_confirm: boolean;
}

export interface PaginatedAnnouncementResponse {
  items: Announcement[];
  total: number;
  limit: number;
  offset: number;
}

export interface AnnouncementRead {
  id: number;
  announcement_id: number;
  user_id: string;
  confirmed: boolean;
  read_at: string;
}

export interface AnnouncementStats {
  announcement_id: number;
  read_count: number;
  confirmed_count: number;
}

export interface AnnouncementReadsResponse {
  items: AnnouncementRead[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  announcement_type: AnnouncementType;
  target_roles?: UserRoleType[] | null;
  target_users?: string[] | null;
  is_popup?: boolean;
  require_confirm?: boolean;
  priority?: number;
  start_time?: string | null;
  end_time?: string | null;
}

export interface UpdateAnnouncementRequest {
  title?: string;
  content?: string;
  announcement_type?: AnnouncementType;
  target_roles?: UserRoleType[] | null;
  target_users?: string[] | null;
  is_popup?: boolean;
  require_confirm?: boolean;
  is_active?: boolean;
  priority?: number;
  start_time?: string | null;
  end_time?: string | null;
  clear_target_roles?: boolean;
  clear_target_users?: boolean;
  clear_start_time?: boolean;
  clear_end_time?: boolean;
}

export const ANNOUNCEMENT_TYPE_OPTIONS = [
  { value: 'update', label: '更新通知' },
  { value: 'warning', label: '警告信息' },
  { value: 'rce', label: 'RCE通知' },
  { value: 'notice', label: '普通通知' },
];

export const ANNOUNCEMENT_TYPE_THEME: Record<AnnouncementType, string> = {
  update: 'primary',
  warning: 'warning',
  rce: 'danger',
  notice: 'default',
};

export const TARGET_ROLE_OPTIONS = [
  { value: 'default', label: '默认用户' },
  { value: 'preview', label: '预览用户' },
  { value: 'vip', label: 'VIP用户' },
  { value: 'admin', label: '管理员' },
];

export class AnnouncementApiService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (isAuthenticationError(response.status)) {
        handleAuthenticationFailure();
      }
      
      throw new Error(errorData.message || `请求失败: ${response.status}`);
    }

    return response.json();
  }
  async getUnreadAnnouncements(): Promise<UnreadAnnouncementsResponse> {
    return this.request('/announcement/unread');
  }

  async getPendingConfirmAnnouncements(): Promise<UnreadAnnouncementsResponse> {
    return this.request('/announcement/pending-confirm');
  }

  async getActiveAnnouncements(): Promise<UnreadAnnouncementsResponse> {
    return this.request('/announcement/active');
  }

  async getAnnouncementDetail(announcementId: number): Promise<UserAnnouncement> {
    return this.request(`/announcement/${announcementId}`);
  }

  async markAsRead(announcementId: number, confirmed: boolean = false): Promise<{ success: boolean; message: string }> {
    return this.request(`/announcement/${announcementId}/read`, {
      method: 'POST',
      body: JSON.stringify({ confirmed }),
    });
  }

  async listAnnouncements(params?: {
    is_active?: boolean;
    announcement_type?: AnnouncementType;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedAnnouncementResponse> {
    const searchParams = new URLSearchParams();
    if (params?.is_active !== undefined) {
      searchParams.append('is_active', String(params.is_active));
    }
    if (params?.announcement_type) {
      searchParams.append('announcement_type', params.announcement_type);
    }
    if (params?.limit !== undefined) {
      searchParams.append('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      searchParams.append('offset', String(params.offset));
    }

    const queryString = searchParams.toString();
    return this.request(`/announcement/admin/list${queryString ? `?${queryString}` : ''}`);
  }

  async getAnnouncementAdminDetail(announcementId: number): Promise<Announcement> {
    return this.request(`/announcement/admin/${announcementId}`);
  }

  async createAnnouncement(data: CreateAnnouncementRequest): Promise<Announcement> {
    return this.request('/announcement/admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAnnouncement(announcementId: number, data: UpdateAnnouncementRequest): Promise<Announcement> {
    return this.request(`/announcement/admin/${announcementId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAnnouncement(announcementId: number): Promise<{ success: boolean; message: string }> {
    return this.request(`/announcement/admin/${announcementId}`, {
      method: 'DELETE',
    });
  }

  async getAnnouncementStats(announcementId: number): Promise<AnnouncementStats> {
    return this.request(`/announcement/admin/${announcementId}/stats`);
  }

  async getAnnouncementReads(
    announcementId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<AnnouncementReadsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) {
      searchParams.append('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      searchParams.append('offset', String(params.offset));
    }

    const queryString = searchParams.toString();
    return this.request(`/announcement/admin/${announcementId}/reads${queryString ? `?${queryString}` : ''}`);
  }
}
