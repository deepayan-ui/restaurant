import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractTokenFromHeader, AuthError, InsufficientPermissionsError } from '@/lib/auth';
import { User } from '@/lib/models';
import { UserRole } from '@/types';

interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export async function authenticate(request: NextRequest): Promise<AuthenticatedRequest> {
  try {
    // Extract token from header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      throw new AuthError('No access token provided', 401, 'NO_TOKEN');
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Optional: Verify user exists and is active
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AuthError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw new AuthError('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Attach user info to request
    (request as AuthenticatedRequest).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    return request as AuthenticatedRequest;

  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('Authentication failed', 401, 'AUTH_FAILED');
  }
}

export function authorize(requiredRole?: UserRole, requiredPermissions?: string[]) {
  return async (request: NextRequest): Promise<void> => {
    const authRequest = await authenticate(request);
    const user = authRequest.user!;

    // Check role requirements
    if (requiredRole) {
      const { hasRole } = await import('@/lib/auth');
      if (!hasRole(user.role, requiredRole)) {
        throw new InsufficientPermissionsError(
          `Requires ${requiredRole} role or higher`
        );
      }
    }

    // Check permission requirements
    if (requiredPermissions && requiredPermissions.length > 0) {
      const { hasPermission } = await import('@/lib/auth');
      for (const permission of requiredPermissions) {
        if (!hasPermission(user.role, permission)) {
          throw new InsufficientPermissionsError(
            `Missing required permission: ${permission}`
          );
        }
      }
    }
  };
}

export function requireCustomer(request: NextRequest): Promise<void> {
  return authorize('customer')(request);
}

export function requireStaff(request: NextRequest): Promise<void> {
  return authorize('staff')(request);
}

export function requireManager(request: NextRequest): Promise<void> {
  return authorize('manager')(request);
}

export function requireAdmin(request: NextRequest): Promise<void> {
  return authorize('admin')(request);
}

export function requireAnyRole(roles: UserRole[]) {
  return async (request: NextRequest): Promise<void> => {
    const authRequest = await authenticate(request);
    const user = authRequest.user!;

    const { hasAnyRole } = await import('@/lib/auth');
    if (!hasAnyRole(user.role, roles)) {
      throw new InsufficientPermissionsError(
        `Requires one of these roles: ${roles.join(', ')}`
      );
    }
  };
}

export function requirePermission(permission: string) {
  return async (request: NextRequest): Promise<void> => {
    const authRequest = await authenticate(request);
    const user = authRequest.user!;

    const { hasPermission } = await import('@/lib/auth');
    if (!hasPermission(user.role, permission)) {
      throw new InsufficientPermissionsError(
        `Missing required permission: ${permission}`
      );
    }
  };
}

export function requirePermissions(permissions: string[]) {
  return async (request: NextRequest): Promise<void> => {
    const authRequest = await authenticate(request);
    const user = authRequest.user!;

    const { hasPermission } = await import('@/lib/auth');
    for (const permission of permissions) {
      if (!hasPermission(user.role, permission)) {
        throw new InsufficientPermissionsError(
          `Missing required permission: ${permission}`
        );
      }
    }
  };
}

// Rate limiting middleware
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) {
  return async (request: NextRequest): Promise<void> => {
    const key = `rate_limit:${request.ip}:${request.nextUrl.pathname}`;
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Clean up old entries
    for (const [storeKey, data] of rateLimitStore.entries()) {
      if (data.resetTime < now) {
        rateLimitStore.delete(storeKey);
      }
    }

    const current = rateLimitStore.get(key);

    if (current && current.resetTime > now) {
      if (current.count >= options.max) {
        throw new AuthError(
          options.message || 'Too many requests, please try again later',
          429,
          'RATE_LIMIT_EXCEEDED'
        );
      }
      current.count++;
    } else {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      });
    }
  };
}

// Predefined rate limits
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts, please try again later'
});

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  message: 'Too many registration attempts, please try again later'
});

export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password resets per hour
  message: 'Too many password reset attempts, please try again later'
});

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Rate limit exceeded, please try again later'
});

// CORS middleware helper
export function handleCors(request: NextRequest, allowedOrigins: string[] = ['http://localhost:3000']) {
  const origin = request.headers.get('origin');

  if (allowedOrigins.includes(origin || '')) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', origin || '');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }

  return NextResponse.next();
}

// Error handling middleware
export function handleAuthError(error: unknown): NextResponse {
  console.error('Authentication error:', error);

  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Unknown error occurred',
      code: 'UNKNOWN_ERROR'
    },
    { status: 500 }
  );
}

export default {
  authenticate,
  authorize,
  requireCustomer,
  requireStaff,
  requireManager,
  requireAdmin,
  requireAnyRole,
  requirePermission,
  requirePermissions,
  rateLimit,
  loginRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  generalRateLimit,
  handleCors,
  handleAuthError
};