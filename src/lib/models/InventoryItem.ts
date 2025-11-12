import mongoose, { Schema } from 'mongoose';
import { IInventoryItem, Supplier, UsageHistory } from '@/types';

const supplierSchema = new Schema<Supplier>({
  name: {
    type: String,
    required: [true, 'Supplier name is required'],
    trim: true,
    maxlength: [100, 'Supplier name cannot exceed 100 characters']
  },
  contactInfo: {
    type: String,
    required: [true, 'Supplier contact info is required'],
    trim: true,
    maxlength: [200, 'Contact info cannot exceed 200 characters']
  },
  leadTime: {
    type: Number,
    required: [true, 'Lead time is required'],
    min: [0, 'Lead time cannot be negative'],
    max: [90, 'Lead time cannot exceed 90 days']
  }
}, { _id: false });

const usageHistorySchema = new Schema<UsageHistory>({
  date: {
    type: Date,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative']
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order'
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Reason cannot exceed 100 characters']
  }
}, { _id: false });

const inventoryItemSchema = new Schema<IInventoryItem>({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    enum: [
      'vegetables',
      'fruits',
      'meat',
      'seafood',
      'dairy',
      'grains',
      'spices',
      'beverages',
      'cleaning',
      'packaging',
      'other'
    ]
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: [0, 'Current stock cannot be negative']
  },
  minimumStock: {
    type: Number,
    required: [true, 'Minimum stock is required'],
    min: [0, 'Minimum stock cannot be negative']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['kg', 'liters', 'pieces', 'boxes']
  },
  unitCost: {
    type: Number,
    required: [true, 'Unit cost is required'],
    min: [0, 'Unit cost cannot be negative']
  },
  supplier: supplierSchema,
  lastRestocked: {
    type: Date
  },
  usageHistory: [usageHistorySchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
inventoryItemSchema.index({ name: 1 });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ isActive: 1 });
inventoryItemSchema.index({ currentStock: 1 });
inventoryItemSchema.index({ minimumStock: 1 });

// Compound indexes for common queries
inventoryItemSchema.index({ category: 1, isActive: 1 });
inventoryItemSchema.index({ isActive: 1, currentStock: 1 });

// Virtuals
inventoryItemSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minimumStock;
});

inventoryItemSchema.virtual('stockLevel').get(function() {
  if (this.currentStock === 0) return 'out';
  if (this.currentStock <= this.minimumStock) return 'low';
  if (this.currentStock <= this.minimumStock * 2) return 'medium';
  return 'high';
});

inventoryItemSchema.virtual('totalValue').get(function() {
  return this.currentStock * this.unitCost;
});

inventoryItemSchema.virtual('daysSinceLastRestock').get(function() {
  if (!this.lastRestocked) return null;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - this.lastRestocked.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

inventoryItemSchema.virtual('averageDailyUsage').get(function() {
  if (this.usageHistory.length === 0 || !this.lastRestocked) return 0;

  const now = new Date();
  const daysSinceRestock = Math.ceil((now.getTime() - this.lastRestocked.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceRestock === 0) return 0;

  const totalUsage = this.usageHistory.reduce((total, usage) => total + usage.quantity, 0);
  return totalUsage / daysSinceRestock;
});

inventoryItemSchema.virtual('estimatedStockOut').get(function() {
  const avgDailyUsage = this.averageDailyUsage;
  if (avgDailyUsage === 0) return null;

  const daysUntilStockOut = Math.floor(this.currentStock / avgDailyUsage);
  const stockOutDate = new Date();
  stockOutDate.setDate(stockOutDate.getDate() + daysUntilStockOut);

  return stockOutDate;
});

// Pre-find middleware
inventoryItemSchema.pre(/^find/, function(next) {
  if (this.getOptions().populateUsageHistory) {
    this.populate({
      path: 'usageHistory.orderId',
      select: 'orderNumber createdAt'
    });
  }
  next();
});

// Static methods
inventoryItemSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ category: 1, name: 1 });
};

inventoryItemSchema.statics.findByCategory = function(category: string) {
  return this.find({ category, isActive: true }).sort({ name: 1 });
};

inventoryItemSchema.statics.findLowStock = function() {
  return this.find({
    isActive: true,
    $expr: { $lte: ['$currentStock', '$minimumStock'] }
  }).sort({ category: 1, name: 1 });
};

inventoryItemSchema.statics.findOutOfStock = function() {
  return this.find({
    isActive: true,
    currentStock: 0
  }).sort({ category: 1, name: 1 });
};

inventoryItemSchema.statics.findBySupplier = function(supplierName: string) {
  return this.find({
    'supplier.name': { $regex: supplierName, $options: 'i' },
    isActive: true
  }).sort({ name: 1 });
};

inventoryItemSchema.statics.getInventoryStats = function() {
  return this.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$currentStock', '$unitCost'] } },
        lowStockItems: {
          $sum: {
            $cond: [
              { $lte: ['$currentStock', '$minimumStock'] },
              1,
              0
            ]
          }
        },
        outOfStockItems: {
          $sum: {
            $cond: [{ $eq: ['$currentStock', 0] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

inventoryItemSchema.statics.getUsageReport = function(startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $unwind: '$usageHistory'
    },
    {
      $match: {
        'usageHistory.date': { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          itemId: '$_id',
          name: '$name',
          category: '$category'
        },
        totalUsage: { $sum: '$usageHistory.quantity' },
        usageCount: { $sum: 1 },
        averageUsage: { $avg: '$usageHistory.quantity' }
      }
    },
    {
      $sort: { totalUsage: -1 }
    }
  ]);
};

// Instance methods
inventoryItemSchema.methods.updateStock = function(quantity: number, reason: string, orderId?: string) {
  this.usageHistory.push({
    date: new Date(),
    quantity,
    orderId,
    reason
  });

  this.currentStock += quantity;

  if (quantity > 0) {
    this.lastRestocked = new Date();
  }

  return this.save();
};

inventoryItemSchema.methods.addToStock = function(quantity: number, reason: string = 'restock') {
  return this.updateStock(quantity, reason);
};

inventoryItemSchema.methods.removeFromStock = function(quantity: number, reason: string, orderId?: string) {
  if (quantity > this.currentStock) {
    throw new Error(`Cannot remove ${quantity} units. Only ${this.currentStock} available.`);
  }
  return this.updateStock(-quantity, reason, orderId);
};

inventoryItemSchema.methods.getStockStatus = function() {
  const status = this.stockLevel;
  const percentage = this.minimumStock > 0 ? (this.currentStock / this.minimumStock) * 100 : 100;

  return {
    status,
    percentage: Math.round(percentage),
    isLowStock: this.isLowStock,
    isOutOfStock: this.currentStock === 0,
    needsRestock: this.isLowStock || this.currentStock === 0,
    estimatedStockOut: this.estimatedStockOut
  };
};

export const InventoryItem = mongoose.models.InventoryItem || mongoose.model<IInventoryItem>('InventoryItem', inventoryItemSchema);
export default InventoryItem;