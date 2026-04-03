import api from './api';

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
  parent_group_id?: number | null;
  parent_group_name?: string | null;
  tag_count?: number;
  tags?: Tag[];
  children?: TagGroup[];
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
  parent_group_id?: number | null;
}

export interface UpdateTagGroupDTO {
  name: string;
  description?: string;
  icon?: string;
  display_order?: number;
  parent_group_id?: number | null;
}

export interface BulkTagOperationResult {
  successIds: number[];
  failed: Array<{ id: number; message: string }>;
}

// Get all tags
export const getTags = async (): Promise<Tag[]> => {
  const response = await api.get('/tags');
  return response.data.data;
};

// Get tag by ID
export const getTagById = async (id: number): Promise<Tag> => {
  const response = await api.get(`/tags/${id}`);
  return response.data.data;
};

// Create new tag
export const createTag = async (data: CreateTagDTO): Promise<Tag> => {
  const response = await api.post('/tags', data);
  return response.data.data;
};

// Update tag
export const updateTag = async (id: number, data: UpdateTagDTO): Promise<Tag> => {
  const response = await api.put(`/tags/${id}`, data);
  return response.data.data;
};

// Delete tag
export const deleteTag = async (id: number): Promise<void> => {
  await api.delete(`/tags/${id}`);
};

// Get tags for a track
export const getTrackTags = async (trackId: number): Promise<Tag[]> => {
  const response = await api.get(`/tags/track/${trackId}`);
  return response.data.data;
};

// Add tag to track
export const addTagToTrack = async (trackId: number, tagId: number): Promise<void> => {
  await api.post(`/tags/track/${trackId}`, { tagId });
};

// Remove tag from track
export const removeTagFromTrack = async (trackId: number, tagId: number): Promise<void> => {
  await api.delete(`/tags/track/${trackId}/${tagId}`);
};

// ============ Tag Groups ============

// Get all tag groups
export const getTagGroups = async (): Promise<TagGroup[]> => {
  const response = await api.get('/tags/groups/all');
  return response.data.data;
};

// Get tag group by ID
export const getTagGroupById = async (id: number): Promise<TagGroup> => {
  const response = await api.get(`/tags/groups/${id}`);
  return response.data.data;
};

// Create tag group
export const createTagGroup = async (data: CreateTagGroupDTO): Promise<TagGroup> => {
  const response = await api.post('/tags/groups', data);
  return response.data.data;
};

// Update tag group
export const updateTagGroup = async (id: number, data: UpdateTagGroupDTO): Promise<TagGroup> => {
  const response = await api.put(`/tags/groups/${id}`, data);
  return response.data.data;
};

// Delete tag group
export const deleteTagGroup = async (id: number): Promise<void> => {
  await api.delete(`/tags/groups/${id}`);
};

// Bulk update track tags
export const bulkUpdateTrackTags = async (params: {
  trackIds: number[];
  addTagIds?: number[];
  removeTagIds?: number[];
}): Promise<void> => {
  await api.post('/tags/bulk-update', params);
};

export const bulkDeleteTags = async (tagIds: number[]): Promise<BulkTagOperationResult> => {
  const settled = await Promise.allSettled(tagIds.map((id) => deleteTag(id)));
  const successIds: number[] = [];
  const failed: Array<{ id: number; message: string }> = [];

  settled.forEach((result, index) => {
    const tagId = tagIds[index];
    if (result.status === 'fulfilled') {
      successIds.push(tagId);
      return;
    }

    const error: any = result.reason;
    failed.push({
      id: tagId,
      message: error?.response?.data?.error?.message || error?.message || '删除失败',
    });
  });

  return { successIds, failed };
};

export const bulkMoveTagsToGroup = async (
  tags: Tag[],
  groupId: number | null
): Promise<BulkTagOperationResult> => {
  const settled = await Promise.allSettled(
    tags.map((tag) =>
      updateTag(tag.id, {
        name: tag.name,
        color: tag.color,
        description: tag.description || undefined,
        group_id: groupId,
        parent_id: tag.parent_id ?? null,
        icon: tag.icon ?? null,
        display_order: tag.display_order || 0,
      })
    )
  );

  const successIds: number[] = [];
  const failed: Array<{ id: number; message: string }> = [];

  settled.forEach((result, index) => {
    const tag = tags[index];
    if (result.status === 'fulfilled') {
      successIds.push(tag.id);
      return;
    }

    const error: any = result.reason;
    failed.push({
      id: tag.id,
      message: error?.response?.data?.error?.message || error?.message || '更新失败',
    });
  });

  return { successIds, failed };
};

