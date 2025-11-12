import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Booking } from '@/lib/models';
import { requireCustomer, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Require customer authentication
    const authRequest = await requireCustomer(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Verify user is requesting their own bookings
    if (authRequest.user!.id !== params.userId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Connect to database
    await connectDB();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const upcoming = searchParams.get('upcoming') === 'true';

    // Build query
    const query: any = { userId: params.userId };

    if (status) {
      query.status = status;
    }

    if (upcoming) {
      query.date = { $gte: new Date() };
      query.status = { $in: ['pending', 'confirmed'] };
    }

    const skip = (page - 1) * limit;

    // Get bookings
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate({
          path: 'userId',
          select: 'email profile.firstName profile.lastName'
        })
        .populate({
          path: 'tableId',
          select: 'tableNumber capacity location shape'
        })
        .sort({ date: -1, time: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query)
    ]);

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        pages
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