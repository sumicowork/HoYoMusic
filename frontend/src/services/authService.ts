import api from './api';
import axios from 'axios';
import { ApiResponse, LoginRequest, LoginResponse, RegisterRequest, User } from '../types';

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as any;
    const detailMessage = responseData?.error?.details?.[0]?.message;
    return detailMessage || responseData?.error?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
      if (response.data.success && response.data.data) {
        localStorage.setItem('token', response.data.data.token);
        return response.data.data;
      }
      throw new Error(response.data.error?.message || 'Login failed');
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Login failed'));
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    throw new Error('Failed to get current user');
  },

  async sendVerificationCode(email: string): Promise<{ message: string; verification_challenge_id?: string }> {
    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail) {
      throw new Error('请输入有效邮箱地址');
    }

    try {
      const response = await api.post<ApiResponse<{ message: string; verification_challenge_id?: string }>>('/auth/send-verification-code', {
        email: normalizedEmail,
      });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error?.message || 'Failed to send verification code');
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Failed to send verification code'));
    }
  },

  async register(payload: RegisterRequest): Promise<LoginResponse> {
    try {
      const response = await api.post<ApiResponse<LoginResponse>>('/auth/register', payload);
      if (response.data.success && response.data.data) {
        localStorage.setItem('token', response.data.data.token);
        return response.data.data;
      }
      throw new Error(response.data.error?.message || 'Registration failed');
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Registration failed'));
    }
  },

  logout() {
    localStorage.removeItem('token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  async sendPhoneCode(phone: string): Promise<{ message: string; verification_challenge_id?: string }> {
    try {
      const response = await api.post<ApiResponse<{ message: string; verification_challenge_id?: string }>>('/auth/send-phone-code', { phone });
      return response.data.data || { message: '验证码已发送' };
    } catch (error) {
      throw new Error(getApiErrorMessage(error, '发送验证码失败'));
    }
  },

  async bindPhone(phone: string, code: string): Promise<void> {
    try {
      const response = await api.post<ApiResponse<{ message: string }>>('/auth/bind-phone', { phone, code });
      if (!response.data.success) throw new Error(response.data.error?.message || '绑定失败');
    } catch (error) {
      throw new Error(getApiErrorMessage(error, '绑定失败'));
    }
  },

  // 账号注销（密码确认；成功即返回，调用方负责登出）
  async deleteAccount(password: string): Promise<ApiResponse<{ message: string }>> {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/delete-account', { password });
    return response.data;
  },
};

