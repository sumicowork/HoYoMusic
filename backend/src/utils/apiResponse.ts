import { Response } from 'express';

/**
 * Standardized API error responses for controllers.
 * Ensures every error follows the same shape:
 * { success: false, error: { code, message } }
 */

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
) => {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
};

export const notFound = (res: Response, resource = 'Resource') =>
  sendError(res, 404, 'NOT_FOUND', `${resource} not found`);

export const badRequest = (res: Response, message = 'Invalid request') =>
  sendError(res, 400, 'BAD_REQUEST', message);

export const serverError = (res: Response, message = 'Internal server error') =>
  sendError(res, 500, 'INTERNAL_ERROR', message);

export const forbidden = (res: Response, message = 'Forbidden') =>
  sendError(res, 403, 'FORBIDDEN', message);

export const unauthorized = (res: Response, message = 'Unauthorized') =>
  sendError(res, 401, 'UNAUTHORIZED', message);

