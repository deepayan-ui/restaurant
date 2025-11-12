import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Order } from '@/lib/models';
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
    const status = searchParams.get('status');
    const orderType = searchParams.get('orderType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query for active orders
    const query: any = {
      status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
    };

    if (status) {
      query.status = status;
    }

    if (orderType) {
      query.orderType = orderType;
    }

    const skip = (page - 1) * limit;

    // Get active orders
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate({
          path: 'userId',
          select: 'email profile.firstName profile.lastName profile.phone'
        })
        .populate({
          path: 'items.menuItemId',
          select: 'name price images preparationTime'
        })
        .sort({ createdAt: 1 }) // Oldest orders first
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query)
    ]);

    const pages = Math.ceil(total / limit);

    // Get order statistics
    const [stats] = await Order.aggregate([
      {
        $match: {
          status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const orderStats = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      totalOrders: 0,
      totalValue: 0
    };

    if (stats) {
      if (Array.isArray(stats)) {
        stats.forEach(stat => {
          orderStats[stat._id as keyof typeof orderStats] = stat.count;
          orderStats.totalOrders += stat.count;
          orderStats.totalValue += stat.totalValue;
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: orders,
      stats: orderStats,
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