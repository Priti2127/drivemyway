import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/index.js';

/**
 * Global error handler — must be registered as the last middleware.
 *
 * Catches anything passed to next(err) and returns a consistent
 * { success: false, error: '...' } envelope.
 */
export function errorHandler(
  err: Error & { status?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log the full stack in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.error('[error]', err.stack);
  } else {
    // In production, log to structured output (picked up by Datadog)
    console.error(JSON.stringify({
      level: 'error',
      message: err.message,
      code: err.code,
      path: req.path,
      method: req.method,
    }));
  }

  const status = err.status ?? 500;
  const body: ApiResponse = {
    success: false,
    error: status === 500 ? 'Something went wrong. Please try again.' : err.message,
  };

  res.status(status).json(body);
}

/**
 * 404 handler — catches routes that didn't match any registered handler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Request logger middleware (dev-friendly, structured in prod).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const log = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
      userId: req.user?.userId,
    };

    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(log));
    } else {
      const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      console.log(
        `${statusColor}${req.method}\x1b[0m ${req.path} → ${res.statusCode} (${ms}ms)`,
      );
    }
  });
  next();
}
