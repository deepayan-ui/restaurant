import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Category } from '@/lib/models';
import { requireCustomer, requireManager, handleAuthError, generalRateLimit } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    await generalRateLimit(request);

    // Connect to database
    await connectDB();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeSubcategories = searchParams.get('includeSubcategories') === 'true';
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Build query
    const query: any = {};
    if (activeOnly) {
      query.isActive = true;
    }

    // Find categories
    const categories = await Category.find(query)
      .populate({
        path: 'subcategories',
        match: activeOnly ? { isActive: true } : {},
        options: { sort: { sortOrder: 1, name: 1 } }
      })
      .sort({ sortOrder: 1, name: 1 });

    return NextResponse.json({
      success: true,
      data: categories
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
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ name: body.name.trim() });
    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Category with this name already exists' },
        { status: 409 }
      );
    }

    // Create category
    const categoryData = {
      name: body.name.trim(),
      description: body.description?.trim(),
      icon: body.icon?.trim(),
      sortOrder: body.sortOrder || 0,
      isActive: body.isActive !== false,
      parentId: body.parentId || null
    };

    const category = new Category(categoryData);
    await category.save();

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Category created successfully'
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