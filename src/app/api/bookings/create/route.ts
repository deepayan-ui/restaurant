import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Booking, Table, User } from '@/lib/models';
import { requireCustomer, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';
import { BookingFormData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Require customer authentication
    const authRequest = await requireCustomer(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Parse request body
    const body: BookingFormData = await request.json();

    // Validate required fields
    if (!body.date || !body.time || !body.partySize || !body.contactPhone) {
      return NextResponse.json(
        { success: false, error: 'Date, time, party size, and contact phone are required' },
        { status: 400 }
      );
    }

    // Validate party size
    if (body.partySize < 1 || body.partySize > 20) {
      return NextResponse.json(
        { success: false, error: 'Party size must be between 1 and 20' },
        { status: 400 }
      );
    }

    // Validate date and time
    const bookingDate = new Date(body.date);
    const bookingTime = body.time;

    if (bookingDate < new Date().setHours(0, 0, 0, 0)) {
      return NextResponse.json(
        { success: false, error: 'Booking date cannot be in the past' },
        { status: 400 }
      );
    }

    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(bookingTime)) {
      return NextResponse.json(
        { success: false, error: 'Invalid time format' },
        { status: 400 }
      );
    }

    // Check if booking is during business hours
    const openingTime = process.env.OPENING_TIME || '08:00';
    const closingTime = process.env.CLOSING_TIME || '23:00';

    if (bookingTime < openingTime || bookingTime > closingTime) {
      return NextResponse.json(
        { success: false, error: `Booking must be between ${openingTime} and ${closingTime}` },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await User.findById(authRequest.user!.id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Find suitable table
    const availableTables = await Table.findAvailable()
      .populate('currentBooking')
      .lean();

    const suitableTable = availableTables.find(table =>
      table.capacity >= body.partySize &&
      isTableAvailable(table, bookingDate, bookingTime, 120) // 2 hours default duration
    );

    if (!suitableTable) {
      return NextResponse.json(
        { success: false, error: 'No suitable tables available for the selected time' },
        { status: 409 }
      );
    }

    // Check for existing bookings for the same user at the same time
    const existingBooking = await Booking.findOne({
      userId: user._id,
      date: bookingDate,
      time: bookingTime,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      return NextResponse.json(
        { success: false, error: 'You already have a booking for this time' },
        { status: 409 }
      );
    }

    // Create booking
    const bookingData = {
      userId: user._id,
      tableId: suitableTable._id,
      date: bookingDate,
      time: bookingTime,
      duration: 120, // 2 hours default
      partySize: body.partySize,
      status: 'pending',
      specialRequests: body.specialRequests || '',
      contactPhone: body.contactPhone
    };

    const booking = new Booking(bookingData);
    await booking.save();

    // Update table status
    await Table.findByIdAndUpdate(
      suitableTable._id,
      {
        status: 'reserved',
        currentBooking: booking._id
      }
    );

    // Populate for response
    await booking.populate([
      {
        path: 'userId',
        select: 'email profile.firstName profile.lastName profile.phone'
      },
      {
        path: 'tableId',
        select: 'tableNumber capacity location shape'
      }
    ]);

    return NextResponse.json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });

  } catch (error) {
    return handleAuthError(error);
  }
}

function isTableAvailable(table: any, date: Date, time: string, duration: number): boolean {
  // For now, just return true if table is available
  // In a real implementation, you would check for existing reservations
  return table.status === 'available';
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