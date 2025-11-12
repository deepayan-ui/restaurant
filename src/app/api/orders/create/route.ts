import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Order, MenuItem, User } from '@/lib/models';
import { requireCustomer, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';
import { OrderFormData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Require customer authentication
    const authRequest = await requireCustomer(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Parse request body
    const body: OrderFormData = await request.json();

    // Validate required fields
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order must contain at least one item' },
        { status: 400 }
      );
    }

    if (!body.orderType) {
      return NextResponse.json(
        { success: false, error: 'Order type is required' },
        { status: 400 }
      );
    }

    // Validate order type specific fields
    if (body.orderType === 'dine-in' && !body.tableNumber) {
      return NextResponse.json(
        { success: false, error: 'Table number is required for dine-in orders' },
        { status: 400 }
      );
    }

    if (body.orderType === 'delivery' && !body.deliveryAddress) {
      return NextResponse.json(
        { success: false, error: 'Delivery address is required for delivery orders' },
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

    // Validate menu items and calculate totals
    let subtotal = 0;
    const validatedItems = [];

    for (const item of body.items) {
      if (!item.menuItemId || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid item data' },
          { status: 400 }
        );
      }

      // Verify menu item exists and is available
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable) {
        return NextResponse.json(
          { success: false, error: `Menu item not available: ${item.menuItemId}` },
          { status: 400 }
        );
      }

      const itemTotal = menuItem.price * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        menuItemId: menuItem._id,
        quantity: item.quantity,
        price: menuItem.price,
        customizations: item.customizations || {},
        specialInstructions: item.specialInstructions || ''
      });
    }

    // Calculate totals
    const taxRate = 0.08; // 8% tax
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    // Create order
    const orderData = {
      userId: user._id,
      items: validatedItems,
      orderType: body.orderType,
      status: 'pending',
      totalAmount,
      taxAmount,
      discountAmount: body.discountAmount || 0,
      paymentStatus: 'pending',
      tableNumber: body.tableNumber,
      deliveryAddress: body.deliveryAddress,
      specialInstructions: body.specialInstructions,
      estimatedTime: calculateEstimatedTime(validatedItems, body.orderType)
    };

    const order = new Order(orderData);
    await order.save();

    // Populate user and menu items for response
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
      message: 'Order created successfully'
    });

  } catch (error) {
    return handleAuthError(error);
  }
}

function calculateEstimatedTime(items: any[], orderType: string): number {
  // Base preparation time calculation
  const baseTime = 15; // 15 minutes base time
  let additionalTime = 0;

  // Add time based on items and quantities
  items.forEach(item => {
    additionalTime += Math.ceil(item.quantity / 2) * 5; // 5 min per 2 items
  });

  // Add time based on order type
  const orderTypeTime = {
    'dine-in': 0,
    'takeaway': 5,
    'delivery': 15
  };

  return baseTime + additionalTime + (orderTypeTime[orderType as keyof typeof orderTypeTime] || 0);
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