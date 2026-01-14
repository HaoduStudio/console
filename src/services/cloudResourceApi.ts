import { handleAuthenticationFailure, isAuthenticationError } from './authUtils';

// API 基础地址
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.dailys.zone/v1';

// 资源类别
export type ResourceCategory = 'emoji' | 'sticker' | 'template' | 'background';

// 资源状态
export type ResourceStatus = 'pending' | 'approved' | 'rejected';

// 云资源数据结构
export interface CloudResource {
  id: number;
  user_id: string;
  key: string;
  filename: string;
  category: ResourceCategory;
  mime_type: string;
  file_size: number;
  url: string;
  status: ResourceStatus;
  is_public: boolean;
  reject_reason: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// 公开资源数据结构（简化版）
export interface PublicResource {
  id: number;
  user_id: string;
  key: string;
  filename: string;
  category: ResourceCategory;
  mime_type: string;
  file_size: number;
  url: string;
  created_at: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// 上传响应
export interface UploadResponse {
  id: number;
  key: string;
  url: string;
  category: ResourceCategory;
  filename: string;
  status: ResourceStatus;
  is_public: boolean;
  message: string;
}

// 可见性更新响应
export interface VisibilityResponse {
  id: number;
  is_public: boolean;
  message: string;
}

// 删除响应
export interface DeleteResponse {
  success: boolean;
  id: number;
}

// 资源类别选项
export const CATEGORY_OPTIONS = [
  { value: 'emoji', label: '表情' },
  { value: 'sticker', label: '贴纸' },
  { value: 'template', label: '模板' },
  { value: 'background', label: '背景' },
];

// 资源状态选项
export const STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
];

// 获取状态显示文本
export const getStatusText = (status: ResourceStatus): string => {
  const statusMap: Record<ResourceStatus, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
  };
  return statusMap[status] || status;
};

// 获取状态主题颜色
export const getStatusTheme = (status: ResourceStatus): 'warning' | 'success' | 'danger' => {
  const themeMap: Record<ResourceStatus, 'warning' | 'success' | 'danger'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
  };
  return themeMap[status] || 'warning';
};

// 获取类别显示文本
export const getCategoryText = (category: ResourceCategory): string => {
  const categoryMap: Record<ResourceCategory, string> = {
    emoji: '表情',
    sticker: '贴纸',
    template: '模板',
    background: '背景',
  };
  return categoryMap[category] || category;
};

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export class CloudResourceApiService {
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
        'Authorization': `Bearer ${this.accessToken}`,
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

  async uploadResource(
    category: ResourceCategory,
    file: File,
    isPublic: boolean = false
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${API_BASE}/cloud-resource/upload/${category}?is_public=${isPublic}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      if (isAuthenticationError(response.status)) {
        const errorData = await response.json().catch(() => ({}));
        await handleAuthenticationFailure(
          errorData.detail || 'Token 无效或已过期，请重新登录'
        );
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `上传失败: ${response.status}`);
    }

    return response.json();
  }

  async getMyResources(params?: {
    category?: ResourceCategory;
    status?: ResourceStatus;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<CloudResource>> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString();
    const endpoint = `/cloud-resource/my${queryString ? `?${queryString}` : ''}`;
    
    return this.request<PaginatedResponse<CloudResource>>(endpoint);
  }

  async getMyResource(resourceId: number): Promise<CloudResource> {
    return this.request<CloudResource>(`/cloud-resource/my/${resourceId}`);
  }

  async setResourceVisibility(
    resourceId: number,
    isPublic: boolean
  ): Promise<VisibilityResponse> {
    return this.request<VisibilityResponse>(
      `/cloud-resource/my/${resourceId}/visibility`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_public: isPublic }),
      }
    );
  }

  async deleteMyResource(resourceId: number): Promise<DeleteResponse> {
    return this.request<DeleteResponse>(
      `/cloud-resource/my/${resourceId}`,
      { method: 'DELETE' }
    );
  }

  static async getPublicResources(params?: {
    category?: ResourceCategory;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<PublicResource>> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString();
    const url = `${API_BASE}/cloud-resource/public${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `请求失败: ${response.status}`);
    }

    return response.json();
  }

  async getPendingResources(params?: {
    category?: ResourceCategory;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<CloudResource>> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString();
    const endpoint = `/admin/cloud-resource/pending${queryString ? `?${queryString}` : ''}`;
    
    return this.request<PaginatedResponse<CloudResource>>(endpoint);
  }

  async getAllResources(params?: {
    category?: ResourceCategory;
    status?: ResourceStatus;
    user_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<CloudResource>> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.user_id) searchParams.append('user_id', params.user_id);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const queryString = searchParams.toString();
    const endpoint = `/admin/cloud-resource/all${queryString ? `?${queryString}` : ''}`;
    
    return this.request<PaginatedResponse<CloudResource>>(endpoint);
  }

  async getResourceStats(category?: ResourceCategory): Promise<CloudResourceStats> {
    const query = category ? `?category=${category}` : '';
    return this.request<CloudResourceStats>(
      `/admin/cloud-resource/stats${query}`
    );
  }

  async getResource(resourceId: number): Promise<CloudResource> {
    return this.request<CloudResource>(
      `/admin/cloud-resource/${resourceId}`
    );
  }

  async approveResource(resourceId: number): Promise<{
    id: number;
    status: string;
    reviewed_by: string;
    reviewed_at: string;
    message: string;
  }> {
    return this.request<{
      id: number;
      status: string;
      reviewed_by: string;
      reviewed_at: string;
      message: string;
    }>(`/admin/cloud-resource/${resourceId}/approve`, {
      method: 'POST',
    });
  }

  async rejectResource(
    resourceId: number,
    reason: string
  ): Promise<{
    id: number;
    status: string;
    reviewed_by: string;
    reviewed_at: string;
    message: string;
  }> {
    return this.request<{
      id: number;
      status: string;
      reviewed_by: string;
      reviewed_at: string;
      message: string;
    }>(`/admin/cloud-resource/${resourceId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });
  }

  async adminDeleteResource(resourceId: number): Promise<{
    success: boolean;
    id: number;
  }> {
    return this.request<{
      success: boolean;
      id: number;
    }>(`/admin/cloud-resource/${resourceId}`, {
      method: 'DELETE',
    });
  }
}

// 资源统计信息接口
export interface CloudResourceStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}
