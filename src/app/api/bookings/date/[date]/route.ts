import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Booking } from '@/lib/models';
import { requireStaff, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    // Require staff authentication
    await requireStaff(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Validate date parameter
    const date = new Date(params.date);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    // Build query
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query: any = {
      date: { $gte: startOfDay, $lte: endOfDay }
    };

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    // Get bookings
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate({
          path: 'userId',
          select: 'email profile.firstName profile.lastName profile.phone'
        })
        .populate({
          path: 'tableId',
          select: 'tableNumber capacity location shape'
        })
        .sort({ time: 1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query)
    ]);

    const pages = Math.ceil(total / limit);

    // Get booking statistics for the day
    const stats = await Booking.aggregate([
      {
        $match: {
          date: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalGuests: { $sum: '$partySize' }
        }
      }
    ]);

    const bookingStats = {
      pending: 0,
      confirmed: 0,
      seated: 0,
      completed: 0,
      cancelled: 0,
      'no-show': 0,
      totalBookings: 0,
      totalGuests: 0
    };

    stats.forEach(stat => {
      const statusKey = stat._id as keyof typeof bookingStats;
      if (statusKey in bookingStats) {
        bookingStats[statusKey] = stat.count;
        bookingStats.totalBookings += stat.count;
        bookingStats.totalGuests += stat.totalGuests;
      }
    });

    return NextResponse.json({
      success: true,
      data: bookings,
      stats: bookingStats,
      date: params.date,
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