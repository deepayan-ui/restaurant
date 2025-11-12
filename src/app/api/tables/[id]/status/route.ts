import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Table, Booking } from '@/lib/models';
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
    const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Find table
    const table = await Table.findById(params.id);
    if (!table) {
      return NextResponse.json(
        { success: false, error: 'Table not found' },
        { status: 404 }
      );
    }

    const oldStatus = table.status;
    const bookingId = body.bookingId;

    // Validate status transitions
    if (body.status === 'occupied' && !bookingId) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required when marking table as occupied' },
        { status: 400 }
      );
    }

    // Verify booking exists if provided
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return NextResponse.json(
          { success: false, error: 'Booking not found' },
          { status: 404 }
        );
      }

      // Update booking status if table is being occupied
      if (body.status === 'occupied') {
        booking.status = 'seated';
        await booking.save();
      }
    }

    // Update table status
    table.status = body.status;

    if (body.status === 'reserved' && bookingId) {
      table.currentBooking = bookingId;
    } else if (body.status === 'available') {
      table.currentBooking = undefined;
    }

    await table.save();

    // Populate for response
    await table.populate({
      path: 'currentBooking',
      select: 'bookingId date time partySize status'
    });

    return NextResponse.json({
      success: true,
      data: table,
      message: `Table status updated from ${oldStatus} to ${body.status}`
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