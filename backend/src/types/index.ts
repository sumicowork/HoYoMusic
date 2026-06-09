export interface User {
  id: number;
  username: string;
  email?: string | null;
  email_verified?: boolean;
  is_admin?: boolean;
}

export interface Track {
  id: number;
  uuid: string;
  title: string;
  title_cn?: string | null;
  title_en?: string | null;
  album_id: number | null;
  file_path: string;
  cover_path: string | null;
  duration: number | null;
  track_number: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  file_size: number | null;
  lyrics_path?: string | null;
  lyrics_status?: 'none' | 'has' | 'instrumental';
  release_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Album {
  id: number;
  uuid: string;
  title: string;
  title_cn?: string | null;
  title_en?: string | null;
  cover_path: string | null;
  release_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TrackCredit {
  credit_key: string;
  credit_value: string;
}

export interface TrackWithDetails extends Track {
  album_title?: string;
  album_cover?: string | null;
  artists: TrackCredit[];
}

