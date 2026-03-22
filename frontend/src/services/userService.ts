import api from './api';
import type { ApiResponse } from '../types';

export interface AdminUserItem {
  id: number;
  username: string;
  email: string | null;
  email_verified: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserListResponse {
  items: AdminUserItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const userService = {
  async getUsers(page = 1, pageSize = 20): Promise<AdminUserListResponse> {
    const response = await api.get<ApiResponse<AdminUserListResponse>>(`/users?page=${page}&pageSize=${pageSize}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch users');
  },
};

