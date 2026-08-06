export interface User {
  id: number;
  username: string;
  email?: string | null;
  email_verified?: boolean;
  phone?: string | null;
  phone_verified?: boolean;
  is_admin?: boolean;
  account_status?: 'active' | 'disabled';
  status_reason?: string | null;
}

export interface Track {
  id: number;
  uuid?: string;
  title: string;
  title_cn?: string | null;
  title_en?: string | null;
  album_id: number | null;
  album_uuid?: string | null;
  file_path: string;
  cover_path: string | null;
  duration: number | null;
  track_number: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  file_size: number | null;
  release_date: string | null;
  notes?: string | null;
  disc_id?: number | null;
  disc_number?: number | null;
  disc_title?: string | null;
  created_at: string;
  updated_at: string;
  album_title?: string;
  album_title_cn?: string | null;
  album_title_en?: string | null;
  album_cover?: string | null;
  favorite_count?: number;
  play_count?: number;
  effective_play_count?: number;
  unique_ips?: number;
  artists: Artist[];
  /** 静态模式：CDN 音频直链 */
  audio_url?: string;
  /** 动态模式：后端歌词文件路径 */
  lyrics_path?: string | null;
  /** 歌词状态：none=无歌词, has=有歌词, instrumental=纯音乐 */
  lyrics_status?: 'none' | 'has' | 'instrumental';
  /** 静态模式：内嵌歌词文本 */
  lyrics?: string | null;
  /** 静态模式：内嵌 credits */
  credits?: Array<{ id: number; credit_key: string; credit_value: string; display_order: number }>;
  /** 静态模式：内嵌 tags */
  tags?: Array<{ id: number; name: string; color: string }>;
}

export interface Artist {
  id: number;
  name: string;
}

export interface TrackMusicSourceItem {
  id: number;
  track_id: number;
  game_id: number;
  game_name?: string | null;
  category_id: number;
  category_name: string;
  node_id: number;
  node_name: string;
  display_order: number;
  path: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Album {
  id: number;
  uuid?: string;
  title: string;
  title_cn?: string | null;
  title_en?: string | null;
  cover_path: string | null;
  release_date: string | null;
  notes?: string | null;
  track_count?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  verification_challenge_id: string;
  verification_code: string;
  password: string;
  confirm_password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Ensure this file is treated as a module
export {};
