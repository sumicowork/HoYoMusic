import { Request, Response } from 'express';
import pool from '../config/database';

// Get credits for a track
export const getCredits = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, credit_key, credit_value, display_order 
       FROM track_credits 
       WHERE track_id = $1 
       ORDER BY display_order ASC, id ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        credits: result.rows
      }
    });
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch credits' }
    });
  }
};

// Add credit
export const addCredit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { credit_key, credit_value, display_order } = req.body;

    if (!credit_key || !credit_value) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATA', message: 'credit_key and credit_value are required' }
      });
    }

    const result = await pool.query(
      `INSERT INTO track_credits (track_id, credit_key, credit_value, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, credit_key, credit_value, display_order`,
      [id, credit_key, credit_value, display_order || 0]
    );

    res.json({
      success: true,
      data: {
        credit: result.rows[0],
        message: 'Credit added successfully'
      }
    });
  } catch (error) {
    console.error('Add credit error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ADD_ERROR', message: 'Failed to add credit' }
    });
  }
};

// Update credit
export const updateCredit = async (req: Request, res: Response) => {
  try {
    const { id, creditId } = req.params;
    const { credit_key, credit_value, display_order } = req.body;

    const result = await pool.query(
      `UPDATE track_credits 
       SET credit_key = $1, credit_value = $2, display_order = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND track_id = $5
       RETURNING id, credit_key, credit_value, display_order`,
      [credit_key, credit_value, display_order, creditId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Credit not found' }
      });
    }

    res.json({
      success: true,
      data: {
        credit: result.rows[0],
        message: 'Credit updated successfully'
      }
    });
  } catch (error) {
    console.error('Update credit error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update credit' }
    });
  }
};

// Delete credit
export const deleteCredit = async (req: Request, res: Response) => {
  try {
    const { id, creditId } = req.params;

    const result = await pool.query(
      'DELETE FROM track_credits WHERE id = $1 AND track_id = $2 RETURNING id',
      [creditId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Credit not found' }
      });
    }

    res.json({
      success: true,
      data: { message: 'Credit deleted successfully' }
    });
  } catch (error) {
    console.error('Delete credit error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete credit' }
    });
  }
};

