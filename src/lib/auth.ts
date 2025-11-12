import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole } from '@/types';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets are not defined in environment variables');
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export class AuthError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 401, code: string = 'AUTH_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AuthError';
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message: string = 'Token has expired') {
    super(message, 401, 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message: string = 'Invalid token') {
    super(message, 401, 'INVALID_TOKEN');
    this.name = 'InvalidTokenError';
  }
}

export class InsufficientPermissionsError extends AuthError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'INSUFFICIENT_PERMISSIONS');
    this.name = 'InsufficientPermissionsError';
  }
}

export class UserNotFoundError extends AuthError {
  constructor(message: string = 'User not found') {
    super(message, 404, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message: string = 'Invalid credentials') {
    super(message, 401, 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountDisabledError extends AuthError {
  constructor(message: string = 'Account is disabled') {
    super(message, 403, 'ACCOUNT_DISABLED');
    this.name = 'AccountDisabledError';
  }
}

export const generateTokenPair = (userId: string, email: string, role: UserRole): TokenPair => {
  try {
    const payload: JwtPayload = {
      userId,
      email,
      role
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: 'restaurant-management-system',
      audience: 'restaurant-users'
    });

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      JWT_REFRESH_SECRET,
      {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'restaurant-management-system',
        audience: 'restaurant-refresh'
      }
    );

    return {
      accessToken,
      refreshToken
    };
  } catch (error) {
    throw new AuthError('Failed to generate tokens');
  }
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'restaurant-management-system',
      audience: 'restaurant-users'
    }) as JwtPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError('Access token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError('Invalid access token');
    } else {
      throw new AuthError('Token verification failed');
    }
  }
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'restaurant-management-system',
      audience: 'restaurant-refresh'
    }) as { userId: string; type: string };

    if (decoded.type !== 'refresh') {
      throw new InvalidTokenError('Invalid refresh token');
    }

    return { userId: decoded.userId };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError('Refresh token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError('Invalid refresh token');
    } else {
      throw new AuthError('Refresh token verification failed');
    }
  }
};

export const refreshAccessToken = (refreshToken: string): { accessToken: string } => {
  const { userId } = verifyRefreshToken(refreshToken);

  // In a real application, you would fetch the user from the database here
  // to get their current email and role
  // For now, we'll generate a new access token with minimal payload

  try {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      JWT_SECRET,
      {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'restaurant-management-system',
        audience: 'restaurant-users'
      }
    );

    return { accessToken };
  } catch (error) {
    throw new AuthError('Failed to refresh access token');
  }
};

// Role hierarchy for permission checking
const roleHierarchy: Record<UserRole, number> = {
  customer: 1,
  staff: 2,
  manager: 3,
  admin: 4
};

export const hasRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

export const hasAnyRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.some(role => hasRole(userRole, role));
};

export const hasPermission = (userRole: UserRole, permission: string): boolean => {
  // Define permissions for each role
  const rolePermissions: Record<UserRole, string[]> = {
    customer: [
      'read:menu',
      'read:own_orders',
      'create:orders',
      'read:own_bookings',
      'create:bookings',
      'update:own_profile'
    ],
    staff: [
      'read:menu',
      'read:orders',
      'update:orders',
      'read:tables',
      'update:tables',
      'read:kitchen_orders',
      'update:order_status',
      'process:payments',
      'read:analytics_basic'
    ],
    manager: [
      'read:menu',
      'create:menu_items',
      'update:menu_items',
      'delete:menu_items',
      'read:orders',
      'create:orders',
      'update:orders',
      'delete:orders',
      'read:bookings',
      'update:bookings',
      'delete:bookings',
      'read:tables',
      'create:tables',
      'update:tables',
      'delete:tables',
      'read:staff',
      'create:staff',
      'update:staff',
      'read:inventory',
      'update:inventory',
      'read:analytics',
      'process:refunds',
      'read:reports'
    ],
    admin: [
      '*' // All permissions
    ]
  };

  if (rolePermissions.admin && rolePermissions.admin.includes('*')) {
    return true;
  }

  return rolePermissions[userRole]?.includes(permission) || false;
};

// Helper function to extract token from Authorization header
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

// Rate limiting helper
export const getRateLimitKey = (userId: string, action: string): string => {
  return `auth_rate_limit:${userId}:${action}`;
};

// Password strength validation
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common patterns
  const commonPatterns = [
    /password/i,
    /123456/,
    /qwerty/i,
    /admin/i
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password cannot contain common patterns');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone number validation (basic)
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export default {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
  hasRole,
  hasAnyRole,
  hasPermission,
  extractTokenFromHeader,
  validatePasswordStrength,
  validateEmail,
  validatePhone,
  AuthError,
  TokenExpiredError,
  InvalidTokenError,
  InsufficientPermissionsError,
  UserNotFoundError,
  InvalidCredentialsError,
  AccountDisabledError
};