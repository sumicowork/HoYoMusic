import { Request, Response } from 'express';
import pool from '../config/database';

// Get all tags with group and hierarchy info
export const getTags = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        t.*,
        tg.name as group_name,
        tg.icon as group_icon,
        tg.display_order as group_order,
        pt.name as parent_name,
        COUNT(DISTINCT tt.track_id) as track_count,
        (
          SELECT COUNT(*) 
          FROM tags ct 
          WHERE ct.parent_id = t.id
        ) as children_count
      FROM tags t
      LEFT JOIN tag_groups tg ON t.group_id = tg.id
      LEFT JOIN tags pt ON t.parent_id = pt.id
      LEFT JOIN track_tags tt ON t.id = tt.tag_id
      GROUP BY t.id, tg.name, tg.icon, tg.display_order, pt.name
      ORDER BY 
        tg.display_order ASC NULLS LAST,
        t.parent_id ASC NULLS FIRST,
        t.display_order ASC,
        t.name ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch tags' }
    });
  }
};

// Get tag by ID with tracks and hierarchy
export const getTagById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get tag info with hierarchy
    const tagQuery = `
      SELECT 
        t.*,
        tg.name as group_name,
        tg.icon as group_icon,
        pt.name as parent_name,
        get_tag_path(t.id) as full_path,
        COUNT(DISTINCT tt.track_id) as track_count,
        (
          SELECT COUNT(*) 
          FROM tags ct 
          WHERE ct.parent_id = t.id
        ) as children_count
      FROM tags t
      LEFT JOIN tag_groups tg ON t.group_id = tg.id
      LEFT JOIN tags pt ON t.parent_id = pt.id
      LEFT JOIN track_tags tt ON t.id = tt.tag_id
      WHERE t.id = $1
      GROUP BY t.id, tg.name, tg.icon, pt.name
    `;

    const tagResult = await pool.query(tagQuery, [id]);

    if (tagResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag not found' }
      });
    }

    const tag = tagResult.rows[0];

    // Get child tags
    const childrenQuery = `
      SELECT 
        t.*,
        COUNT(DISTINCT tt.track_id) as track_count
      FROM tags t
      LEFT JOIN track_tags tt ON t.id = tt.tag_id
      WHERE t.parent_id = $1
      GROUP BY t.id
      ORDER BY t.display_order ASC, t.name ASC
    `;
    const childrenResult = await pool.query(childrenQuery, [id]);

    // Get all tracks with this tag
    const tracksQuery = `
      SELECT 
        tr.*,
        a.title as album_title,
        a.cover_path as album_cover,
        array_agg(DISTINCT jsonb_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM track_tags tt
      INNER JOIN tracks tr ON tt.track_id = tr.id
      LEFT JOIN albums a ON tr.album_id = a.id
      LEFT JOIN track_artists ta ON tr.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE tt.tag_id = $1
      GROUP BY tr.id, a.title, a.cover_path
      ORDER BY tr.created_at DESC
    `;

    const tracksResult = await pool.query(tracksQuery, [id]);

    res.json({
      success: true,
      data: {
        ...tag,
        children: childrenResult.rows,
        tracks: tracksResult.rows.map(row => ({
          ...row,
          artists: row.artists.filter((a: any) => a.id !== null)
        }))
      }
    });
  } catch (error) {
    console.error('Get tag error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch tag' }
    });
  }
};

// Create new tag
export const createTag = async (req: Request, res: Response) => {
  try {
    const { name, color, description, group_id, parent_id, icon, display_order } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tag name is required' }
      });
    }

    // Validate parent_id if provided
    if (parent_id) {
      const parentCheck = await pool.query('SELECT id FROM tags WHERE id = $1', [parent_id]);
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Parent tag not found' }
        });
      }
    }

    // Validate group_id if provided
    if (group_id) {
      const groupCheck = await pool.query('SELECT id FROM tag_groups WHERE id = $1', [group_id]);
      if (groupCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Tag group not found' }
        });
      }
    }

    const query = `
      INSERT INTO tags (name, color, description, group_id, parent_id, icon, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(query, [
      name.trim(),
      color || '#1890ff',
      description || null,
      group_id || null,
      parent_id || null,
      icon || null,
      display_order || 0
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Create tag error:', error);

    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'Tag name already exists' }
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to create tag' }
    });
  }
};

// Update tag
export const updateTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, description, group_id, parent_id, icon, display_order } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tag name is required' }
      });
    }

    // Prevent self-reference
    if (parent_id && parseInt(parent_id) === parseInt(id as string)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tag cannot be its own parent' }
      });
    }

    // Validate parent_id if provided
    if (parent_id) {
      const parentCheck = await pool.query('SELECT id FROM tags WHERE id = $1', [parent_id]);
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Parent tag not found' }
        });
      }
    }

    // Validate group_id if provided
    if (group_id) {
      const groupCheck = await pool.query('SELECT id FROM tag_groups WHERE id = $1', [group_id]);
      if (groupCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Tag group not found' }
        });
      }
    }

    const query = `
      UPDATE tags
      SET name = $1, color = $2, description = $3, group_id = $4, 
          parent_id = $5, icon = $6, display_order = $7
      WHERE id = $8
      RETURNING *
    `;

    const result = await pool.query(query, [
      name.trim(),
      color || '#1890ff',
      description || null,
      group_id || null,
      parent_id || null,
      icon || null,
      display_order !== undefined ? display_order : 0,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag not found' }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Update tag error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'Tag name already exists' }
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update tag' }
    });
  }
};

// Delete tag
export const deleteTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM tags WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag not found' }
      });
    }

    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete tag' }
    });
  }
};

// Get tags for a specific track
export const getTrackTags = async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;

    const query = `
      SELECT t.*
      FROM track_tags tt
      INNER JOIN tags t ON tt.tag_id = t.id
      WHERE tt.track_id = $1
      ORDER BY t.name ASC
    `;

    const result = await pool.query(query, [trackId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get track tags error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch track tags' }
    });
  }
};

// Add tag to track
export const addTagToTrack = async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const { tagId } = req.body;

    // Verify track exists
    const trackCheck = await pool.query('SELECT id FROM tracks WHERE id = $1', [trackId]);
    if (trackCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    // Verify tag exists
    const tagCheck = await pool.query('SELECT id FROM tags WHERE id = $1', [tagId]);
    if (tagCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag not found' }
      });
    }

    const query = `
      INSERT INTO track_tags (track_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT (track_id, tag_id) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(query, [trackId, tagId]);

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'Tag already added to track' }
      });
    }

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Add tag to track error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ADD_ERROR', message: 'Failed to add tag to track' }
    });
  }
};

// Remove tag from track
export const removeTagFromTrack = async (req: Request, res: Response) => {
  try {
    const { trackId, tagId } = req.params;

    const query = 'DELETE FROM track_tags WHERE track_id = $1 AND tag_id = $2 RETURNING *';
    const result = await pool.query(query, [trackId, tagId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag not found on track' }
      });
    }

    res.json({
      success: true,
      message: 'Tag removed from track'
    });
  } catch (error) {
    console.error('Remove tag from track error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REMOVE_ERROR', message: 'Failed to remove tag from track' }
    });
  }
};

// ============ Tag Groups Management ============

// Get all tag groups
export const getTagGroups = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        tg.*,
        COUNT(DISTINCT t.id) as tag_count
      FROM tag_groups tg
      LEFT JOIN tags t ON tg.id = t.group_id
      GROUP BY tg.id
      ORDER BY tg.display_order ASC, tg.name ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get tag groups error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch tag groups' }
    });
  }
};

// Get tag group by ID with tags
export const getTagGroupById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const groupQuery = `
      SELECT 
        tg.*,
        COUNT(DISTINCT t.id) as tag_count
      FROM tag_groups tg
      LEFT JOIN tags t ON tg.id = t.group_id
      WHERE tg.id = $1
      GROUP BY tg.id
    `;

    const groupResult = await pool.query(groupQuery, [id]);

    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag group not found' }
      });
    }

    const tagsQuery = `
      SELECT 
        t.*,
        COUNT(DISTINCT tt.track_id) as track_count,
        (SELECT COUNT(*) FROM tags ct WHERE ct.parent_id = t.id) as children_count
      FROM tags t
      LEFT JOIN track_tags tt ON t.id = tt.tag_id
      WHERE t.group_id = $1
      GROUP BY t.id
      ORDER BY t.display_order ASC, t.name ASC
    `;

    const tagsResult = await pool.query(tagsQuery, [id]);

    res.json({
      success: true,
      data: {
        ...groupResult.rows[0],
        tags: tagsResult.rows
      }
    });
  } catch (error) {
    console.error('Get tag group error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch tag group' }
    });
  }
};

// Create tag group
export const createTagGroup = async (req: Request, res: Response) => {
  try {
    const { name, description, icon, display_order } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Group name is required' }
      });
    }

    const query = `
      INSERT INTO tag_groups (name, description, icon, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(query, [
      name.trim(),
      description || null,
      icon || null,
      display_order || 0
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Create tag group error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'Group name already exists' }
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to create tag group' }
    });
  }
};

// Update tag group
export const updateTagGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon, display_order } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Group name is required' }
      });
    }

    const query = `
      UPDATE tag_groups
      SET name = $1, description = $2, icon = $3, display_order = $4
      WHERE id = $5
      RETURNING *
    `;

    const result = await pool.query(query, [
      name.trim(),
      description || null,
      icon || null,
      display_order !== undefined ? display_order : 0,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag group not found' }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Update tag group error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'Group name already exists' }
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update tag group' }
    });
  }
};

// Delete tag group
export const deleteTagGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const checkQuery = 'SELECT COUNT(*) as count FROM tags WHERE group_id = $1';
    const checkResult = await pool.query(checkQuery, [id]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_TAGS',
          message: 'Cannot delete group with tags. Move or delete tags first.'
        }
      });
    }

    const query = 'DELETE FROM tag_groups WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag group not found' }
      });
    }

    res.json({
      success: true,
      message: 'Tag group deleted successfully'
    });
  } catch (error) {
    console.error('Delete tag group error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete tag group' }
    });
  }
};

