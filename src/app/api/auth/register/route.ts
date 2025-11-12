import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/lib/models';
import { generateTokenPair, validatePasswordStrength, validateEmail, validatePhone, AuthError } from '@/lib/auth';
import { registerRateLimit, handleAuthError } from '@/lib/middleware/auth';
import { RegisterForm } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    await registerRateLimit(request);

    // Connect to database
    await connectDB();

    // Parse request body
    const body: RegisterForm = await request.json();

    // Validate required fields
    const requiredFields = ['email', 'password', 'firstName', 'lastName'];
    for (const field of requiredFields) {
      if (!body[field as keyof RegisterForm]) {
        throw new AuthError(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`, 400, 'MISSING_FIELD');
      }
    }

    // Validate email format
    if (!validateEmail(body.email)) {
      throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(body.password);
    if (!passwordValidation.isValid) {
      throw new AuthError(
        `Password requirements not met: ${passwordValidation.errors.join(', ')}`,
        400,
        'WEAK_PASSWORD'
      );
    }

    // Validate phone if provided
    if (body.phone && !validatePhone(body.phone)) {
      throw new AuthError('Invalid phone number format', 400, 'INVALID_PHONE');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: body.email.toLowerCase() });
    if (existingUser) {
      throw new AuthError('User with this email already exists', 409, 'USER_EXISTS');
    }

    // Create new user
    const userData = {
      email: body.email.toLowerCase(),
      password: body.password,
      role: 'customer' as const,
      profile: {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        phone: body.phone?.trim()
      },
      isActive: true
    };

    const user = new User(userData);
    await user.save();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokens = generateTokenPair(
      user._id.toString(),
      user.email,
      user.role
    );

    // Prepare user data for response
    const responseUserData = {
      id: user._id,
      email: user.email,
      role: user.role,
      profile: user.profile,
      staffProfile: user.staffProfile,
      lastLogin: user.lastLogin,
      isActive: user.isActive
    };

    return NextResponse.json({
      success: true,
      data: {
        user: responseUserData,
        tokens
      },
      message: 'Registration successful'
    });

  } catch (error) {
    return handleAuthError(error);
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}