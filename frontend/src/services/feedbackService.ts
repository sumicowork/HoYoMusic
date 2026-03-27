import api from './api';

export interface FeedbackItem {
  id: number;
  content: string;
  contact: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface FeedbackListResult {
  items: FeedbackItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const feedbackService = {
  async submit(content: string, contact?: string): Promise<void> {
    const response = await api.post('/public/feedback', {
      content,
      contact: contact || '',
    });

    if (!response.data?.success) {
      throw new Error(response.data?.error?.message || '反馈提交失败');
    }
  },

  async getAdminList(page = 1, pageSize = 20): Promise<FeedbackListResult> {
    const response = await api.get('/settings/feedback', {
      params: { page, pageSize },
    });

    if (!response.data?.success) {
      throw new Error(response.data?.error?.message || '加载反馈列表失败');
    }

    return response.data.data as FeedbackListResult;
  },
};


