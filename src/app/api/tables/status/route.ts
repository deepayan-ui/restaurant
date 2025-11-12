import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Table } from '@/lib/models';
import { requireStaff, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Require staff authentication
    await requireStaff(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const status = searchParams.get('status');

    // Build query
    const query: any = {};

    if (location) {
      query.location = location;
    }

    if (status) {
      query.status = status;
    }

    // Get tables
    const tables = await Table.find(query)
      .populate({
        path: 'currentBooking',
        select: 'bookingId date time partySize status'
      })
      .sort({ location: 1, capacity: 1, tableNumber: 1 });

    // Get table statistics
    const stats = await Table.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' }
        }
      }
    ]);

    const tableStats = {
      available: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
      totalTables: 0,
      totalCapacity: 0
    };

    stats.forEach(stat => {
      const statusKey = stat._id as keyof typeof tableStats;
      if (statusKey in tableStats) {
        tableStats[statusKey] = stat.count;
        tableStats.totalTables += stat.count;
        tableStats.totalCapacity += stat.totalCapacity;
      }
    });

    // Get available tables by capacity
    const availableByCapacity = await Table.aggregate([
      {
        $match: { status: 'available' }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ['$capacity', 2] }, then: 'small' },
                { case: { $and: [{ $gt: ['$capacity', 2] }, { $lte: ['$capacity', 4] }] }, then: 'medium' },
                { case: { $and: [{ $gt: ['$capacity', 4] }, { $lte: ['$capacity', 6] }] }, then: 'large' }
              ],
              default: 'extra-large'
            }
          },
          count: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' }
        }
      }
    ]);

    const capacityStats: Record<string, { count: number; capacity: number }> = {};
    availableByCapacity.forEach(stat => {
      capacityStats[stat._id] = {
        count: stat.count,
        capacity: stat.totalCapacity
      };
    });

    return NextResponse.json({
      success: true,
      data: tables,
      stats: tableStats,
      capacityStats
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