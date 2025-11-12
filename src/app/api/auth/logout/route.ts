import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleAuthError } from '@/lib/middleware/auth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    await authenticate(request);

    // In a real application with token blacklisting, you would:
    // 1. Add the access token to a blacklist (Redis)
    // 2. Remove the refresh token from user's valid tokens
    // 3. Log the logout event

    // For now, we'll just return success since JWTs are stateless
    // The client should delete the tokens from their storage

    return NextResponse.json({
      success: true,
      message: 'Logout successful'
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