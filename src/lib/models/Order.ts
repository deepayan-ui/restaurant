import mongoose, { Schema } from 'mongoose';
import { IOrder, OrderItem, DeliveryAddress } from '@/types';

const deliveryAddressSchema = new Schema<DeliveryAddress>({
  street: {
    type: String,
    required: function() {
      return (this.parent as any).orderType === 'delivery';
    },
    trim: true
  },
  city: {
    type: String,
    required: function() {
      return (this.parent as any).orderType === 'delivery';
    },
    trim: true
  },
  postalCode: {
    type: String,
    required: function() {
      return (this.parent as any).orderType === 'delivery';
    },
    trim: true,
    match: [/^[0-9]{5,10}$/, 'Please enter a valid postal code']
  },
  coordinates: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  }
}, { _id: false });

const orderItemSchema = new Schema<OrderItem>({
  menuItemId: {
    type: Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    max: [99, 'Quantity cannot exceed 99']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  customizations: {
    type: Schema.Types.Mixed,
    default: {}
  },
  specialInstructions: {
    type: String,
    trim: true,
    maxlength: [200, 'Special instructions cannot exceed 200 characters']
  }
}, { _id: false });

const orderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    required: [true, 'Order number is required'],
    unique: true,
    trim: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  items: [orderItemSchema],
  orderType: {
    type: String,
    required: [true, 'Order type is required'],
    enum: ['dine-in', 'takeaway', 'delivery'],
    default: 'dine-in'
  },
  status: {
    type: String,
    required: [true, 'Order status is required'],
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  taxAmount: {
    type: Number,
    required: [true, 'Tax amount is required'],
    min: [0, 'Tax amount cannot be negative'],
    default: 0
  },
  discountAmount: {
    type: Number,
    required: [true, 'Discount amount is required'],
    min: [0, 'Discount amount cannot be negative'],
    default: 0
  },
  paymentStatus: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'wallet']
  },
  tableNumber: {
    type: Number,
    min: [1, 'Table number must be at least 1']
  },
  deliveryAddress: deliveryAddressSchema,
  estimatedTime: {
    type: Number,
    min: [5, 'Estimated time must be at least 5 minutes']
  },
  actualTime: {
    type: Number,
    min: [0, 'Actual time cannot be negative']
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderType: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ completedAt: -1 });

// Compound indexes for common queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderType: 1, status: 1 });

// Virtuals
orderSchema.virtual('subtotal').get(function() {
  return this.totalAmount - this.taxAmount + this.discountAmount;
});

orderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

orderSchema.virtual('formattedTotal').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.totalAmount);
});

orderSchema.virtual('estimatedDeliveryTime').get(function() {
  if (this.estimatedTime && this.createdAt) {
    const deliveryTime = new Date(this.createdAt.getTime() + this.estimatedTime * 60000);
    return deliveryTime;
  }
  return null;
});

orderSchema.virtual('isPaid').get(function() {
  return this.paymentStatus === 'paid';
});

orderSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

orderSchema.virtual('isCancelled').get(function() {
  return this.status === 'cancelled';
});

orderSchema.virtual('isActive').get(function() {
  return !['completed', 'cancelled'].includes(this.status);
});

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Find the last order for today
    const lastOrder = await this.constructor
      .findOne({ orderNumber: { $regex: `^ORD${year}${month}${day}` } })
      .sort({ orderNumber: -1 })
      .select('orderNumber');

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-3));
      sequence = lastSequence + 1;
    }

    this.orderNumber = `ORD${year}${month}${day}${String(sequence).padStart(3, '0')}`;
  }
  next();
});

// Pre-save middleware to set completedAt timestamp
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// Pre-find middleware
orderSchema.pre(/^find/, function(next) {
  // Always populate user info unless explicitly disabled
  if (this.getOptions().populateUser !== false) {
    this.populate({
      path: 'userId',
      select: 'email profile.firstName profile.lastName profile.phone'
    });
  }

  // Always populate menu items unless explicitly disabled
  if (this.getOptions().populateItems !== false) {
    this.populate({
      path: 'items.menuItemId',
      select: 'name price images'
    });
  }

  next();
});

// Static methods
orderSchema.statics.findByUser = function(userId: string, limit?: number) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit || 50);
};

orderSchema.statics.findActive = function() {
  return this.find({
    status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
  }).sort({ createdAt: 1 });
};

orderSchema.statics.findByStatus = function(status: string) {
  return this.find({ status }).sort({ createdAt: -1 });
};

orderSchema.statics.findByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: -1 });
};

orderSchema.statics.getRevenueStats = function(startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed',
        paymentStatus: 'paid'
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: '$totalAmount' },
        totalItems: { $sum: { $size: '$items' } }
      }
    }
  ]);
};

// Instance methods
orderSchema.methods.updateStatus = function(newStatus: string) {
  this.status = newStatus;
  if (newStatus === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  return this.save();
};

orderSchema.methods.calculateTotal = function() {
  this.totalAmount = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Calculate tax (8% by default, can be made configurable)
  this.taxAmount = this.totalAmount * 0.08;
  this.totalAmount += this.taxAmount;

  return this.save();
};

export const Order = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);
export default Order;