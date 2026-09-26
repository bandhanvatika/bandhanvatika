import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'bandhan-vatika-secure-jwt-secret-2026';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'ACCOUNTANT' | 'RECEPTIONIST' | 'STAFF';
  phone?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please log in.' },
    });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid token.' },
    });
  }

  try {
    // Verify user still exists in DB
    const [dbUser] = await db.select().from(users).where(eq(users.id, decoded.id));
    if (!dbUser || dbUser.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'User account is inactive or not found.' },
      });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      name: dbUser.name,
      role: dbUser.role as any,
      phone: dbUser.phone,
    };

    next();
  } catch (err: any) {
    console.error('Authentication database lookup error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_AUTH_ERROR', message: 'Authentication verification service error.' },
    });
  }
};

export const requireRoles = (allowedRoles: ('OWNER' | 'MANAGER' | 'ACCOUNTANT' | 'RECEPTIONIST' | 'STAFF')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    if (req.user.role === 'OWNER') {
      return next(); // Owner has full bypass access
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Role '${req.user.role}' is not authorized for this operation.`,
        },
      });
    }

    next();
  };
};
