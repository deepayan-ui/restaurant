import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { MenuItem, Category } from '@/lib/models';
import { requireCustomer, requireManager, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Get menu item
    const menuItem = await MenuItem.findById(params.id)
      .populate('category', 'name icon description');

    if (!menuItem) {
      return NextResponse.json(
        { success: false, error: 'Menu item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: menuItem
    });

  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require manager role
    await requireManager(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Parse request body
    const body = await request.json();

    // Find existing menu item
    const menuItem = await MenuItem.findById(params.id);
    if (!menuItem) {
      return NextResponse.json(
        { success: false, error: 'Menu item not found' },
        { status: 404 }
      );
    }

    // Validate category if provided
    if (body.category) {
      const category = await Category.findById(body.category);
      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Update menu item
    const updates: any = {};

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim();
    if (body.category !== undefined) updates.category = body.category;
    if (body.price !== undefined) {
      if (body.price < 0) {
        return NextResponse.json(
          { success: false, error: 'Price must be non-negative' },
          { status: 400 }
        );
      }
      updates.price = parseFloat(body.price);
    }
    if (body.images !== undefined) updates.images = body.images;
    if (body.ingredients !== undefined) updates.ingredients = body.ingredients;
    if (body.allergens !== undefined) updates.allergens = body.allergens;
    if (body.isAvailable !== undefined) updates.isAvailable = body.isAvailable;
    if (body.preparationTime !== undefined) {
      if (body.preparationTime < 1 || body.preparationTime > 180) {
        return NextResponse.json(
          { success: false, error: 'Preparation time must be between 1 and 180 minutes' },
          { status: 400 }
        );
      }
      updates.preparationTime = body.preparationTime;
    }
    if (body.nutritionInfo !== undefined) updates.nutritionInfo = body.nutritionInfo;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.tags !== undefined) updates.tags = body.tags;

    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('category', 'name icon sortOrder');

    return NextResponse.json({
      success: true,
      data: updatedMenuItem,
      message: 'Menu item updated successfully'
    });

  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require manager role
    await requireManager(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Find and delete menu item
    const menuItem = await MenuItem.findByIdAndDelete(params.id);

    if (!menuItem) {
      return NextResponse.json(
        { success: false, error: 'Menu item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Menu item deleted successfully'
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
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}