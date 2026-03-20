import api, { IS_STATIC } from './api';
import * as staticData from './staticDataService';

export interface FirstVisitModalConfig {
  enabled: boolean;
  title: string;
  content: string;
  min_stay_seconds: number;
  version: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export const DEFAULT_FIRST_VISIT_MODAL_CONFIG: FirstVisitModalConfig = {
  enabled: false,
  title: '欢迎来到 HoYoMusic',
  content: '本站仅用于音乐欣赏与资料整理。请遵守相关法律法规。',
  min_stay_seconds: 5,
  version: '1',
};

export const siteConfigService = {
  async getPublicFirstVisitModal(): Promise<FirstVisitModalConfig> {
    if (IS_STATIC) {
      return staticData.getFirstVisitModalConfig();
    }

    const response = await api.get<ApiResponse<FirstVisitModalConfig>>('/public/site-config/first-visit-modal');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch first-visit modal config');
  },

  async getAdminFirstVisitModal(): Promise<FirstVisitModalConfig> {
    const response = await api.get<ApiResponse<FirstVisitModalConfig>>('/settings/first-visit-modal');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch first-visit modal config');
  },

  async updateAdminFirstVisitModal(payload: {
    enabled: boolean;
    title: string;
    content: string;
    min_stay_seconds: number;
  }): Promise<FirstVisitModalConfig> {
    const response = await api.put<ApiResponse<FirstVisitModalConfig>>('/settings/first-visit-modal', payload);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to update first-visit modal config');
  },
};

