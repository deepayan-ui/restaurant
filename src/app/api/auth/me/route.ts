import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/lib/models';
import { authenticate, handleAuthError } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authRequest = await authenticate(request);
    const user = authRequest.user!;

    // Connect to database
    await connectDB();

    // Get user details from database
    const userDetails = await User.findById(user.id)
      .select('-password')
      .populate('staffProfile.permissions');

    if (!userDetails) {
      throw new Error('User not found');
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: userDetails._id,
          email: userDetails.email,
          role: userDetails.role,
          profile: userDetails.profile,
          staffProfile: userDetails.staffProfile,
          lastLogin: userDetails.lastLogin,
          isActive: userDetails.isActive,
          createdAt: userDetails.createdAt
        }
      }
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}