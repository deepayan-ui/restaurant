import mongoose, { Schema } from 'mongoose';
import { IMenuItem, NutritionInfo } from '@/types';

const nutritionInfoSchema = new Schema<NutritionInfo>({
  calories: { type: Number, min: 0 },
  protein: { type: Number, min: 0 },
  carbs: { type: Number, min: 0 },
  fat: { type: Number, min: 0 }
}, { _id: false });

const menuItemSchema = new Schema<IMenuItem>({
  name: {
    type: String,
    required: [true, 'Menu item name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    max: [9999.99, 'Price cannot exceed 9999.99']
  },
  images: [{
    type: String,
    trim: true
  }],
  ingredients: [{
    type: String,
    trim: true
  }],
  allergens: [{
    type: String,
    trim: true
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  preparationTime: {
    type: Number,
    required: [true, 'Preparation time is required'],
    min: [1, 'Preparation time must be at least 1 minute'],
    max: [180, 'Preparation time cannot exceed 180 minutes']
  },
  nutritionInfo: nutritionInfoSchema,
  sortOrder: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
menuItemSchema.index({ name: 'text', description: 'text' });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ price: 1 });
menuItemSchema.index({ isAvailable: 1 });
menuItemSchema.index({ sortOrder: 1 });
menuItemSchema.index({ tags: 1 });
menuItemSchema.index({ createdAt: -1 });

// Compound indexes for common queries
menuItemSchema.index({ category: 1, isAvailable: 1, sortOrder: 1 });
menuItemSchema.index({ isAvailable: 1, price: 1 });

// Virtuals
menuItemSchema.virtual('formattedPrice').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.price);
});

menuItemSchema.virtual('mainImage').get(function() {
  return this.images && this.images.length > 0 ? this.images[0] : null;
});

// Pre-find middleware
menuItemSchema.pre(/^find/, function(next) {
  // Always populate category info unless explicitly disabled
  if (this.getOptions().populateCategory !== false) {
    this.populate({
      path: 'category',
      select: 'name icon sortOrder',
      match: { isActive: true }
    });
  }

  // Sort by availability and sort order by default
  if (!this.getOptions().sort) {
    this.sort({ isAvailable: -1, sortOrder: 1, name: 1 });
  }

  next();
});

// Static methods
menuItemSchema.statics.findAvailable = function() {
  return this.find({ isAvailable: true });
};

menuItemSchema.statics.findByCategory = function(categoryId: string) {
  return this.find({
    category: categoryId,
    isAvailable: true
  }).sort({ sortOrder: 1, name: 1 });
};

menuItemSchema.statics.searchItems = function(searchTerm: string) {
  return this.find({
    $and: [
      { isAvailable: true },
      {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { tags: { $in: [new RegExp(searchTerm, 'i')] } }
        ]
      }
    ]
  });
};

menuItemSchema.statics.findByPriceRange = function(min: number, max: number) {
  return this.find({
    isAvailable: true,
    price: { $gte: min, $lte: max }
  }).sort({ price: 1 });
};

// Instance methods
menuItemSchema.methods.toggleAvailability = function() {
  this.isAvailable = !this.isAvailable;
  return this.save();
};

export const MenuItem = mongoose.models.MenuItem || mongoose.model<IMenuItem>('MenuItem', menuItemSchema);
export default MenuItem;