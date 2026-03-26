import api from './api';
import type { ApiResponse } from '../types';

export interface InboxMessageItem {
  id: number;
  message_id: number;
  delivered_at: string;
  is_read: boolean;
  read_at: string | null;
  title: string;
  content: string;
  is_broadcast: boolean;
  created_at: string;
  expires_at: string | null;
  sender_username: string | null;
}

export interface InboxResponse {
  items: InboxMessageItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const messageService = {
  async getInbox(page = 1, pageSize = 10): Promise<InboxResponse> {
    const response = await api.get<ApiResponse<InboxResponse>>(`/messages/inbox?page=${page}&pageSize=${pageSize}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch inbox');
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<ApiResponse<{ unread: number }>>('/messages/unread-count');
    if (response.data.success && response.data.data) {
      return Number(response.data.data.unread || 0);
    }
    throw new Error(response.data.error?.message || 'Failed to fetch unread count');
  },

  async markRead(deliveryId: number): Promise<void> {
    const response = await api.post<ApiResponse<{ delivery: { id: number } }>>(`/messages/${deliveryId}/read`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to mark message as read');
    }
  },

  async markAllRead(): Promise<number> {
    const response = await api.post<ApiResponse<{ updated: number }>>('/messages/read-all');
    if (response.data.success && response.data.data) {
      return Number(response.data.data.updated || 0);
    }
    throw new Error(response.data.error?.message || 'Failed to mark all messages as read');
  },

  async sendByAdmin(payload: {
    title: string;
    content: string;
    is_broadcast: boolean;
    recipient_user_ids?: number[];
    expires_at?: string | null;
  }): Promise<{ delivery_count: number }> {
    const response = await api.post<ApiResponse<{ delivery_count: number }>>('/messages/admin/send', payload);
    if (response.data.success && response.data.data) {
      return { delivery_count: Number(response.data.data.delivery_count || 0) };
    }
    throw new Error(response.data.error?.message || 'Failed to send site message');
  },
};

