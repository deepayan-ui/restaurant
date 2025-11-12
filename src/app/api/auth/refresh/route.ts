import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken, verifyRefreshToken, AuthError } from '@/lib/auth';
import { handleAuthError } from '@/lib/middleware/auth';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    if (!body.refreshToken) {
      throw new AuthError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
    }

    // Verify refresh token and get user ID
    const { userId } = verifyRefreshToken(body.refreshToken);

    // Generate new access token
    const { accessToken } = refreshAccessToken(body.refreshToken);

    return NextResponse.json({
      success: true,
      data: {
        accessToken,
        userId
      },
      message: 'Token refreshed successfully'
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