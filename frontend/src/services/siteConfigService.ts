import api, { IS_STATIC } from './api';
import * as staticData from './staticDataService';

export interface FirstVisitModalConfig {
  enabled: boolean;
  title: string;
  content: string;
  min_stay_seconds: number;
  version: string;
}

export interface SiteComplianceConfig {
  enabled: boolean;
  icp_number: string;
  public_security_number: string;
}

export interface MaintenanceModeConfig {
  enabled: boolean;
  expected_end_time: string | null;
  version: string;
}

export interface TestEmailPayload {
  email: string;
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

export const DEFAULT_SITE_COMPLIANCE_CONFIG: SiteComplianceConfig = {
  enabled: false,
  icp_number: '',
  public_security_number: '',
};

export const DEFAULT_MAINTENANCE_MODE_CONFIG: MaintenanceModeConfig = {
  enabled: false,
  expected_end_time: null,
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

  async getPublicComplianceConfig(): Promise<SiteComplianceConfig> {
    if (IS_STATIC) {
      return staticData.getSiteComplianceConfig();
    }

    const response = await api.get<ApiResponse<SiteComplianceConfig>>('/public/site-config/compliance');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch compliance config');
  },

  async getAdminComplianceConfig(): Promise<SiteComplianceConfig> {
    const response = await api.get<ApiResponse<SiteComplianceConfig>>('/settings/compliance');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch compliance config');
  },

  async updateAdminComplianceConfig(payload: SiteComplianceConfig): Promise<SiteComplianceConfig> {
    const response = await api.put<ApiResponse<SiteComplianceConfig>>('/settings/compliance', payload);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to update compliance config');
  },

  async sendAdminTestEmail(payload: TestEmailPayload): Promise<{ message: string }> {
    const response = await api.post<ApiResponse<{ message: string }>>('/settings/test-email', payload);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to send test email');
  },

  async getPublicMaintenanceMode(): Promise<MaintenanceModeConfig> {
    if (IS_STATIC) {
      return staticData.getMaintenanceModeConfig();
    }

    const response = await api.get<ApiResponse<MaintenanceModeConfig>>('/public/site-config/maintenance');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch maintenance mode config');
  },

  async getAdminMaintenanceMode(): Promise<MaintenanceModeConfig> {
    const response = await api.get<ApiResponse<MaintenanceModeConfig>>('/settings/maintenance');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to fetch maintenance mode config');
  },

  async updateAdminMaintenanceMode(payload: {
    enabled: boolean;
    expected_end_time: string | null;
  }): Promise<MaintenanceModeConfig> {
    const response = await api.put<ApiResponse<MaintenanceModeConfig>>('/settings/maintenance', payload);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to update maintenance mode config');
  },
};


