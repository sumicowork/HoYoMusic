import api from './api';
import { ApiResponse, LoginRequest, LoginResponse, RegisterRequest, User } from '../types';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    if (response.data.success && response.data.data) {
      localStorage.setItem('token', response.data.data.token);
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Login failed');
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    throw new Error('Failed to get current user');
  },

  async sendVerificationCode(email: string): Promise<{ message: string }> {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/send-verification-code', { email });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to send verification code');
  },

  async register(payload: RegisterRequest): Promise<LoginResponse> {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/register', payload);
    if (response.data.success && response.data.data) {
      localStorage.setItem('token', response.data.data.token);
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Registration failed');
  },

  logout() {
    localStorage.removeItem('token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },
};

