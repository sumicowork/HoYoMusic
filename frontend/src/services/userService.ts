import api from './api';
import type { ApiResponse } from '../types';

export interface AdminUserItem {
  id: number;
  username: string;
  email: string | null;
  email_verified: boolean;
  is_admin: boolean;
  account_status: 'active' | 'disabled';
  status_reason: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserListFilters {
  keyword?: string;
  role?: 'all' | 'admin' | 'user';
  verified?: 'all' | 'verified' | 'unverified';
  status?: 'all' | 'active' | 'disabled';
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
  async getUsers(page = 1, pageSize = 20, filters: UserListFilters = {}): Promise<AdminUserListResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('pageSize', String(pageSize));

    if (filters.keyword?.trim()) searchParams.set('keyword', filters.keyword.trim());
    if (filters.role && filters.role !== 'all') searchParams.set('role', filters.role);
    if (filters.verified && filters.verified !== 'all') searchParams.set('verified', filters.verified);
    if (filters.status && filters.status !== 'all') searchParams.set('status', filters.status);

    const response = await api.get<ApiResponse<AdminUserListResponse>>(`/users?${searchParams.toString()}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch users');
  },

  async updateRole(userId: number, isAdmin: boolean): Promise<AdminUserItem> {
    const response = await api.patch<ApiResponse<{ user: AdminUserItem }>>(`/users/${userId}/role`, {
      is_admin: isAdmin,
    });
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    throw new Error(response.data.error?.message || 'Failed to update user role');
  },

  async updateStatus(userId: number, status: 'active' | 'disabled', reason?: string): Promise<AdminUserItem> {
    const response = await api.patch<ApiResponse<{ user: AdminUserItem }>>(`/users/${userId}/status`, {
      account_status: status,
      status_reason: reason?.trim() || null,
    });
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    throw new Error(response.data.error?.message || 'Failed to update user status');
  },

  async updateEmailVerification(userId: number, emailVerified: boolean): Promise<AdminUserItem> {
    const response = await api.patch<ApiResponse<{ user: AdminUserItem }>>(`/users/${userId}/email-verification`, {
      email_verified: emailVerified,
    });
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    throw new Error(response.data.error?.message || 'Failed to update email verification');
  },

  async resetPassword(userId: number, newPassword: string): Promise<void> {
    const response = await api.post<ApiResponse<{ message: string }>>(`/users/${userId}/reset-password`, {
      new_password: newPassword,
    });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to reset password');
    }
  },
};

