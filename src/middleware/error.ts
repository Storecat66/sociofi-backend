import { Request, Response, NextFunction } from 'express';
import { HttpError, ResponseBuilder } from '../utils/http';
import env from '../config/env';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: Error | HttpError,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Log error in development
  if (env.NODE_ENV === 'development') {
    console.error('Error:', error);
  }

  // Handle custom HTTP errors
  if (error instanceof HttpError) {
    ResponseBuilder.error(res, error.message, error.statusCode);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    ResponseBuilder.error(res, 'Invalid token', 401);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    ResponseBuilder.error(res, 'Token expired', 401);
    return;
  }

  // Handle validation errors (Zod)
  if (error.name === 'ZodError') {
    const zodError = error as any;
    const message = zodError.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
    ResponseBuilder.error(res, `Validation error: ${message}`, 400);
    return;
  }

  // Handle MySQL errors
  if ((error as any).code) {
    const mysqlError = error as any;
    switch (mysqlError.code) {
      case 'ER_DUP_ENTRY':
        ResponseBuilder.error(res, 'Duplicate entry', 409);
        return;
      case 'ER_NO_REFERENCED_ROW_2':
        ResponseBuilder.error(res, 'Referenced record not found', 400);
        return;
      case 'ER_ROW_IS_REFERENCED_2':
        ResponseBuilder.error(res, 'Cannot delete record due to references', 409);
        return;
      default:
        if (env.NODE_ENV === 'development') {
          ResponseBuilder.error(res, `Database error: ${mysqlError.message}`, 500);
        } else {
          ResponseBuilder.error(res, 'Database error', 500);
        }
        return;
    }
  }

  // Default error response
  if (env.NODE_ENV === 'development') {
    ResponseBuilder.error(res, error.message || 'Internal Server Error', 500);
  } else {
    ResponseBuilder.error(res, 'Internal Server Error', 500);
  }
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  ResponseBuilder.error(res, `Route ${req.method} ${req.path} not found`, 404);
};

/**
 * Async error wrapper to catch async errors in route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};