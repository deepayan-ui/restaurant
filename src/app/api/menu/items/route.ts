import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { MenuItem, Category } from '@/lib/models';
import { requireCustomer, requireManager, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const availableOnly = searchParams.get('availableOnly') !== 'false';
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query
    const query: any = {};

    if (availableOnly) {
      query.isAvailable = true;
    }

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;

    const [menuItems, total] = await Promise.all([
      MenuItem.find(query)
        .populate('category', 'name icon sortOrder')
        .sort({ sortOrder: 1, name: 1 })
        .skip(skip)
        .limit(limit),
      MenuItem.countDocuments(query)
    ]);

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: menuItems,
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

export async function POST(request: NextRequest) {
  try {
    // Require manager role
    await requireManager(request);

    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.category || !body.price) {
      return NextResponse.json(
        { success: false, error: 'Name, category, and price are required' },
        { status: 400 }
      );
    }

    if (body.price < 0) {
      return NextResponse.json(
        { success: false, error: 'Price must be non-negative' },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = await Category.findById(body.category);
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Create menu item
    const menuItemData = {
      name: body.name.trim(),
      description: body.description?.trim(),
      category: body.category,
      price: parseFloat(body.price),
      images: body.images || [],
      ingredients: body.ingredients || [],
      allergens: body.allergens || [],
      isAvailable: body.isAvailable !== false,
      preparationTime: body.preparationTime || 15,
      nutritionInfo: body.nutritionInfo || {},
      sortOrder: body.sortOrder || 0,
      tags: body.tags || []
    };

    const menuItem = new MenuItem(menuItemData);
    await menuItem.save();

    // Populate category for response
    await menuItem.populate('category', 'name icon sortOrder');

    return NextResponse.json({
      success: true,
      data: menuItem,
      message: 'Menu item created successfully'
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}