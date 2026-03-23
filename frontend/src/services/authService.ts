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

  async sendVerificationCode(email: string): Promise<{ message: string }> {
    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail) {
      throw new Error('请输入有效邮箱地址');
    }

    try {
      const response = await api.post<ApiResponse<{ message: string }>>('/auth/send-verification-code', {
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
};

