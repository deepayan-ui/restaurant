import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/lib/models';
import { generateTokenPair, validatePasswordStrength, AuthError } from '@/lib/auth';
import { loginRateLimit, handleAuthError } from '@/lib/middleware/auth';
import { LoginForm } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    await loginRateLimit(request);

    // Connect to database
    await connectDB();

    // Parse request body
    const body: LoginForm = await request.json();

    // Validate input
    if (!body.email || !body.password) {
      throw new AuthError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    // Find user with password
    const user = await User.findByEmail(body.email);

    if (!user) {
      throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthError('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Compare passwords
    const isPasswordValid = await user.comparePassword(body.password);

    if (!isPasswordValid) {
      throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

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
    const userData = {
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
        user: userData,
        tokens
      },
      message: 'Login successful'
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