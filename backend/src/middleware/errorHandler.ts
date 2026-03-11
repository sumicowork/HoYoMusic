import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, hide internal error details from clients
  const message = isProduction && statusCode >= 500
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
};

export default errorHandler;

