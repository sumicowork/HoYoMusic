import api from './api';
import axios from 'axios';

export type CommentTargetType = 'track' | 'album' | 'game' | 'artist';

export interface CommentItem {
  id: number;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user: { id: number; username: string };
}

export interface CommentListResult {
  comments: CommentItem[];
  total: number;
  page: number;
  page_size: number;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as any;
    return d?.error?.message || d?.error?.details?.[0]?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export const commentService = {
  async list(targetType: CommentTargetType, targetId: number, page = 1): Promise<CommentListResult> {
    const response = await api.get('/comments', { params: { target_type: targetType, target_id: targetId, page, page_size: 20 } });
    return response.data.data;
  },

  async create(targetType: CommentTargetType, targetId: number, content: string): Promise<{ id: number; status: string; message: string }> {
    try {
      const response = await api.post('/comments', { target_type: targetType, target_id: targetId, content });
      return response.data.data.comment;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, '评论失败'));
    }
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/comments/${id}`);
  },

  async report(id: number, reason: string, detail?: string): Promise<void> {
    try {
      await api.post(`/comments/${id}/report`, { reason, detail });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, '举报失败'));
    }
  },
};

export const ratingService = {
  async get(targetType: CommentTargetType, targetId: number): Promise<{
    count: number;
    average: number;
    distribution: Record<string, number>;
    my_score: number | null;
  }> {
    const response = await api.get('/ratings', { params: { target_type: targetType, target_id: targetId } });
    return response.data.data;
  },

  async submit(targetType: CommentTargetType, targetId: number, score: number): Promise<void> {
    try {
      await api.post('/ratings', { target_type: targetType, target_id: targetId, score });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, '评分失败'));
    }
  },
};
