import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
  group_id?: number | null;
  group_name?: string | null;
  group_icon?: string | null;
  parent_id?: number | null;
  parent_name?: string | null;
  icon?: string | null;
  display_order?: number;
  full_path?: string;
  track_count?: number;
  children_count?: number;
  children?: Tag[];
  created_at: string;
  updated_at: string;
  tracks?: any[];
}

export interface TagGroup {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  tag_count?: number;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
}

export interface CreateTagDTO {
  name: string;
  color?: string;
  description?: string;
  group_id?: number | null;
  parent_id?: number | null;
  icon?: string | null;
  display_order?: number;
}

export interface UpdateTagDTO {
  name: string;
  color?: string;
  description?: string;
  group_id?: number | null;
  parent_id?: number | null;
  icon?: string | null;
  display_order?: number;
}

export interface CreateTagGroupDTO {
  name: string;
  description?: string;
  icon?: string;
  display_order?: number;
}

export interface UpdateTagGroupDTO {
  name: string;
  description?: string;
  icon?: string;
  display_order?: number;
}

// Get all tags
export const getTags = async (): Promise<Tag[]> => {
  const response = await axios.get(`${API_URL}/tags`);
  return response.data.data;
};

// Get tag by ID
export const getTagById = async (id: number): Promise<Tag> => {
  const response = await axios.get(`${API_URL}/tags/${id}`);
  return response.data.data;
};

// Create new tag
export const createTag = async (data: CreateTagDTO): Promise<Tag> => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`${API_URL}/tags`, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data.data;
};

// Update tag
export const updateTag = async (id: number, data: UpdateTagDTO): Promise<Tag> => {
  const token = localStorage.getItem('token');
  const response = await axios.put(`${API_URL}/tags/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data.data;
};

// Delete tag
export const deleteTag = async (id: number): Promise<void> => {
  const token = localStorage.getItem('token');
  await axios.delete(`${API_URL}/tags/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

// Get tags for a track
export const getTrackTags = async (trackId: number): Promise<Tag[]> => {
  const response = await axios.get(`${API_URL}/tags/track/${trackId}`);
  return response.data.data;
};

// Add tag to track
export const addTagToTrack = async (trackId: number, tagId: number): Promise<void> => {
  const token = localStorage.getItem('token');
  await axios.post(
    `${API_URL}/tags/track/${trackId}`,
    { tagId },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
};

// Remove tag from track
export const removeTagFromTrack = async (trackId: number, tagId: number): Promise<void> => {
  const token = localStorage.getItem('token');
  await axios.delete(`${API_URL}/tags/track/${trackId}/${tagId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

// ============ Tag Groups ============

// Get all tag groups
export const getTagGroups = async (): Promise<TagGroup[]> => {
  const response = await axios.get(`${API_URL}/tags/groups/all`);
  return response.data.data;
};

// Get tag group by ID
export const getTagGroupById = async (id: number): Promise<TagGroup> => {
  const response = await axios.get(`${API_URL}/tags/groups/${id}`);
  return response.data.data;
};

// Create tag group
export const createTagGroup = async (data: CreateTagGroupDTO): Promise<TagGroup> => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`${API_URL}/tags/groups`, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data.data;
};

// Update tag group
export const updateTagGroup = async (id: number, data: UpdateTagGroupDTO): Promise<TagGroup> => {
  const token = localStorage.getItem('token');
  const response = await axios.put(`${API_URL}/tags/groups/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data.data;
};

// Delete tag group
export const deleteTagGroup = async (id: number): Promise<void> => {
  const token = localStorage.getItem('token');
  await axios.delete(`${API_URL}/tags/groups/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

