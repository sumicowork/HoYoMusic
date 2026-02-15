export interface User {
  id: number;
  username: string;
}

export interface Track {
  id: number;
  title: string;
  album_id: number | null;
  file_path: string;
  cover_path: string | null;
  duration: number | null;
  track_number: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  file_size: number | null;
  release_date: string | null;
  created_at: string;
  updated_at: string;
  album_title?: string;
  artists: Artist[];
}

export interface Artist {
  id: number;
  name: string;
}

export interface Album {
  id: number;
  title: string;
  cover_path: string | null;
  release_date: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Ensure this file is treated as a module
export {};
