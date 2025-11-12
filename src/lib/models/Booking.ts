import mongoose, { Schema } from 'mongoose';
import { IBooking } from '@/types';

const bookingSchema = new Schema<IBooking>({
  bookingId: {
    type: String,
    required: [true, 'Booking ID is required'],
    unique: true,
    trim: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  tableId: {
    type: Schema.Types.ObjectId,
    ref: 'Table',
    required: [true, 'Table is required']
  },
  date: {
    type: Date,
    required: [true, 'Booking date is required'],
    min: [new Date(), 'Booking date cannot be in the past']
  },
  time: {
    type: String,
    required: [true, 'Booking time is required'],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [30, 'Duration must be at least 30 minutes'],
    max: [240, 'Duration cannot exceed 240 minutes'],
    default: 120
  },
  partySize: {
    type: Number,
    required: [true, 'Party size is required'],
    min: [1, 'Party size must be at least 1'],
    max: [20, 'Party size cannot exceed 20']
  },
  status: {
    type: String,
    required: [true, 'Booking status is required'],
    enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show'],
    default: 'pending'
  },
  specialRequests: {
    type: String,
    trim: true,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  contactPhone: {
    type: String,
    required: [true, 'Contact phone is required'],
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ userId: 1 });
bookingSchema.index({ tableId: 1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });

// Compound indexes for common queries
bookingSchema.index({ userId: 1, date: -1 });
bookingSchema.index({ tableId: 1, date: 1, time: 1 });
bookingSchema.index({ date: 1, status: 1 });
bookingSchema.index({ status: 1, date: -1 });

// Virtuals
bookingSchema.virtual('dateTime').get(function() {
  return new Date(`${this.date.toISOString().split('T')[0]}T${this.time}:00`);
});

bookingSchema.virtual('endTime').get(function() {
  const endTime = new Date(`${this.date.toISOString().split('T')[0]}T${this.time}:00`);
  endTime.setMinutes(endTime.getMinutes() + this.duration);
  return endTime;
});

bookingSchema.virtual('isToday').get(function() {
  const today = new Date();
  return this.date.toDateString() === today.toDateString();
});

bookingSchema.virtual('isUpcoming').get(function() {
  return this.dateTime > new Date();
});

bookingSchema.virtual('isPast').get(function() {
  return this.endTime < new Date();
});

bookingSchema.virtual('isActive').get(function() {
  return !['completed', 'cancelled', 'no-show'].includes(this.status);
});

// Pre-save middleware to generate booking ID
bookingSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Find the last booking for today
    const lastBooking = await this.constructor
      .findOne({ bookingId: { $regex: `^BK${year}${month}${day}` } })
      .sort({ bookingId: -1 })
      .select('bookingId');

    let sequence = 1;
    if (lastBooking) {
      const lastSequence = parseInt(lastBooking.bookingId.slice(-3));
      sequence = lastSequence + 1;
    }

    this.bookingId = `BK${year}${month}${day}${String(sequence).padStart(3, '0')}`;
  }
  next();
});

// Pre-find middleware
bookingSchema.pre(/^find/, function(next) {
  // Always populate user info unless explicitly disabled
  if (this.getOptions().populateUser !== false) {
    this.populate({
      path: 'userId',
      select: 'email profile.firstName profile.lastName profile.phone'
    });
  }

  // Always populate table info unless explicitly disabled
  if (this.getOptions().populateTable !== false) {
    this.populate({
      path: 'tableId',
      select: 'tableNumber capacity location shape'
    });
  }

  next();
});

// Static methods
bookingSchema.statics.findByUser = function(userId: string, limit?: number) {
  return this.find({ userId })
    .sort({ date: -1, time: -1 })
    .limit(limit || 50);
};

bookingSchema.statics.findByDate = function(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    date: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ time: 1 });
};

bookingSchema.statics.findByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1, time: 1 });
};

bookingSchema.statics.findActive = function() {
  return this.find({
    status: { $in: ['pending', 'confirmed', 'seated'] },
    date: { $gte: new Date() }
  }).sort({ date: 1, time: 1 });
};

bookingSchema.statics.findByTable = function(tableId: string, startDate: Date, endDate: Date) {
  return this.find({
    tableId,
    date: { $gte: startDate, $lte: endDate },
    status: { $in: ['confirmed', 'seated'] }
  }).sort({ date: 1, time: 1 });
};

bookingSchema.statics.checkTableAvailability = function(tableId: string, date: Date, time: string, duration: number, excludeBookingId?: string) {
  const bookingDateTime = new Date(`${date.toISOString().split('T')[0]}T${time}:00`);
  const endTime = new Date(bookingDateTime.getTime() + duration * 60000);

  const query: any = {
    tableId,
    date,
    status: { $in: ['confirmed', 'seated'] },
    $or: [
      // New booking starts during existing booking
      {
        time: { $lt: new Date(bookingDateTime.getTime() + duration * 60000).toTimeString().slice(0, 5) },
        $expr: {
          $gte: [
            { $add: [new Date(`${date.toISOString().split('T')[0]}T$${time}:00`), { $multiply: ['$duration', 60000] }] },
            bookingDateTime
          ]
        }
      },
      // Existing booking starts during new booking
      {
        time: { $gte: time },
        $expr: {
          $lte: [
            new Date(`${date.toISOString().split('T')[0]}T$${time}:00`),
            { $add: [bookingDateTime, { $multiply: [duration, 60000] }] }
          ]
        }
      }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  return this.find(query);
};

bookingSchema.statics.getBookingStats = function(startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalPartySize: { $sum: '$partySize' }
      }
    }
  ]);
};

// Instance methods
bookingSchema.methods.updateStatus = function(newStatus: string) {
  this.status = newStatus;
  return this.save();
};

bookingSchema.methods.canBeCancelled = function() {
  const now = new Date();
  const bookingDateTime = this.dateTime;
  const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Can cancel if more than 2 hours before booking time
  return hoursUntilBooking > 2 && !['completed', 'cancelled', 'no-show'].includes(this.status);
};

bookingSchema.methods.isConflictingWith = function(otherBooking: IBooking) {
  if (this.tableId.toString() !== otherBooking.tableId.toString()) {
    return false;
  }

  if (this.date.toDateString() !== otherBooking.date.toDateString()) {
    return false;
  }

  const thisStart = this.dateTime;
  const thisEnd = this.endTime;
  const otherStart = otherBooking.dateTime;
  const otherEnd = new Date(otherBooking.dateTime.getTime() + otherBooking.duration * 60000);

  return (thisStart < otherEnd) && (otherStart < thisEnd);
};

export const Booking = mongoose.models.Booking || mongoose.model<IBooking>('Booking', bookingSchema);
export default Booking;