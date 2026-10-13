import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, ApiResponse, UserRole } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  // Fail loudly in production; warn in dev
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is not set');
  } else {
    console.warn('[auth middleware] WARNING: JWT_SECRET not set, using insecure default');
  }
}

// Extend Express Request to carry the decoded token payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verifies the Bearer JWT in the Authorization header.
 * Attaches decoded payload to req.user on success.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const body: ApiResponse = { success: false, error: 'Missing or malformed Authorization header' };
    res.status(401).json(body);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    const body: ApiResponse = {
      success: false,
      error: isExpired ? 'Token expired, please refresh' : 'Invalid token',
    };
    res.status(401).json(body);
  }
}

/**
 * Role-based access control middleware factory.
 * Usage: router.get('/admin-only', authenticate, requireRole('admin'), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Required role: [${roles.join(', ')}]`,
      });
      return;
    }

    next();
  };
}

/**
 * Generates a JWT access token (short-lived).
 */
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

/**
 * Generates a JWT refresh token (long-lived).
 */
export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
