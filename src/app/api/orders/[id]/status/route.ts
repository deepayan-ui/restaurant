import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Order } from '@/lib/models';
import { requireStaff, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require staff authentication
    await requireStaff(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Parse request body
    const body = await request.json();

    if (!body.status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Find order
    const order = await Order.findById(params.id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['completed'],
      'completed': [], // No transitions from completed
      'cancelled': [] // No transitions from cancelled
    };

    const currentStatus = order.status;
    if (currentStatus !== body.status) {
      const allowedTransitions = validTransitions[currentStatus];
      if (!allowedTransitions.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Cannot transition from ${currentStatus} to ${body.status}` },
          { status: 400 }
        );
      }
    }

    // Update order status
    const oldStatus = order.status;
    order.status = body.status;

    // Set completion timestamp
    if (body.status === 'completed') {
      order.completedAt = new Date();
    }

    // Set actual time if order is completed or ready
    if (body.status === 'completed' || body.status === 'ready') {
      if (order.createdAt) {
        const actualTime = Math.round((new Date().getTime() - order.createdAt.getTime()) / (1000 * 60));
        order.actualTime = actualTime;
      }
    }

    await order.save();

    // Populate for response
    await order.populate([
      {
        path: 'userId',
        select: 'email profile.firstName profile.lastName profile.phone'
      },
      {
        path: 'items.menuItemId',
        select: 'name price images'
      }
    ]);

    return NextResponse.json({
      success: true,
      data: order,
      message: `Order status updated from ${oldStatus} to ${body.status}`
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
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}