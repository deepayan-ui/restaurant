import mongoose, { Schema } from 'mongoose';
import { ITable } from '@/types';

const tableSchema = new Schema<ITable>({
  tableNumber: {
    type: String,
    required: [true, 'Table number is required'],
    unique: true,
    trim: true,
    match: [/^[A-Z0-9-]+$/, 'Table number can only contain uppercase letters, numbers, and hyphens']
  },
  capacity: {
    type: Number,
    required: [true, 'Table capacity is required'],
    min: [1, 'Table must have at least 1 seat'],
    max: [20, 'Table cannot have more than 20 seats']
  },
  location: {
    type: String,
    required: [true, 'Table location is required'],
    trim: true,
    enum: [
      'indoor-main',
      'indupper-terrace',
      'outdoor-patio',
      'outdoor-garden',
      'private-room-1',
      'private-room-2',
      'bar-area',
      'lounge'
    ]
  },
  shape: {
    type: String,
    required: [true, 'Table shape is required'],
    enum: ['round', 'square', 'rectangle'],
    default: 'rectangle'
  },
  status: {
    type: String,
    required: [true, 'Table status is required'],
    enum: ['available', 'occupied', 'reserved', 'maintenance'],
    default: 'available'
  },
  currentBooking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking'
  },
  qrCode: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
tableSchema.index({ tableNumber: 1 });
tableSchema.index({ status: 1 });
tableSchema.index({ location: 1 });
tableSchema.index({ capacity: 1 });
tableSchema.index({ currentBooking: 1 });

// Compound indexes for common queries
tableSchema.index({ status: 1, location: 1 });
tableSchema.index({ status: 1, capacity: 1 });

// Virtuals
tableSchema.virtual('isOccupied').get(function() {
  return this.status === 'occupied';
});

tableSchema.virtual('isReserved').get(function() {
  return this.status === 'reserved';
});

tableSchema.virtual('isAvailable').get(function() {
  return this.status === 'available';
});

// Pre-find middleware
tableSchema.pre(/^find/, function(next) {
  // Always populate current booking if exists
  this.populate({
    path: 'currentBooking',
    select: 'bookingId date time partySize status'
  });
  next();
});

// Static methods
tableSchema.statics.findAvailable = function() {
  return this.find({ status: 'available' }).sort({ location: 1, capacity: 1, tableNumber: 1 });
};

tableSchema.statics.findByCapacity = function(minCapacity: number) {
  return this.find({
    capacity: { $gte: minCapacity },
    status: 'available'
  }).sort({ capacity: 1, location: 1 });
};

tableSchema.statics.findByLocation = function(location: string) {
  return this.find({ location }).sort({ capacity: 1, tableNumber: 1 });
};

tableSchema.statics.findOccupied = function() {
  return this.find({ status: 'occupied' })
    .populate({
      path: 'currentBooking',
      populate: {
        path: 'userId',
        select: 'email profile.firstName profile.lastName'
      }
    });
};

tableSchema.statics.findReserved = function() {
  return this.find({ status: 'reserved' })
    .populate({
      path: 'currentBooking',
      populate: {
        path: 'userId',
        select: 'email profile.firstName profile.lastName'
      }
    });
};

// Instance methods
tableSchema.methods.updateStatus = function(newStatus: string, bookingId?: string) {
  this.status = newStatus;
  if (newStatus === 'reserved' && bookingId) {
    this.currentBooking = bookingId;
  } else if (newStatus === 'available') {
    this.currentBooking = undefined;
  }
  return this.save();
};

tableSchema.methods.canAccommodate = function(partySize: number) {
  return this.capacity >= partySize && this.status === 'available';
};

export const Table = mongoose.models.Table || mongoose.model<ITable>('Table', tableSchema);
export default Table;