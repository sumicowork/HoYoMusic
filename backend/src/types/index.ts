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
  release_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Album {
  id: number;
  title: string;
  cover_path: string | null;
  release_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Artist {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface TrackWithDetails extends Track {
  album_title?: string;
  artists: Artist[];
}

