import mongoose, { Schema } from 'mongoose';
import { ICategory } from '@/types';

const categorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  icon: {
    type: String,
    trim: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Category'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
categorySchema.index({ name: 1 });
categorySchema.index({ sortOrder: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ parentId: 1 });

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentId'
});

// Virtual for menu items in this category
categorySchema.virtual('menuItems', {
  ref: 'MenuItem',
  localField: '_id',
  foreignField: 'category'
});

// Pre-find middleware to populate subcategories
categorySchema.pre(/^find/, function(next) {
  if (this.getOptions().populateSubcategories) {
    this.populate({
      path: 'subcategories',
      match: { isActive: true },
      options: { sort: { sortOrder: 1, name: 1 } }
    });
  }
  next();
});

// Static methods
categorySchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.statics.findRootCategories = function() {
  return this.find({ parentId: { $exists: false }, isActive: true })
    .sort({ sortOrder: 1, name: 1 });
};

export const Category = mongoose.models.Category || mongoose.model<ICategory>('Category', categorySchema);
export default Category;