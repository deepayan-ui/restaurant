import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, UserProfile, StaffProfile } from '@/types';

interface IUserDocument extends IUser, Document {
  comparePassword(password: string): Promise<boolean>;
}

const userProfileSchema = new Schema<UserProfile>({
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  phone: { type: String, trim: true },
  avatar: { type: String },
  preferences: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const staffProfileSchema = new Schema<StaffProfile>({
  employeeId: { type: String, required: true, unique: true },
  position: { type: String, required: true },
  hireDate: { type: Date, required: true },
  permissions: [{ type: String }],
  schedule: {
    monday: { start: String, end: String },
    tuesday: { start: String, end: String },
    wednesday: { start: String, end: String },
    thursday: { start: String, end: String },
    friday: { start: String, end: String },
    saturday: { start: String, end: String },
    sunday: { start: String, end: String }
  }
}, { _id: false });

const userSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['customer', 'staff', 'manager', 'admin'],
    default: 'customer'
  },
  profile: userProfileSchema,
  staffProfile: staffProfileSchema,
  lastLogin: { type: Date },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'staffProfile.employeeId': 1 });
userSchema.index({ isActive: 1 });

// Middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Static methods
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email }).select('+password');
};

userSchema.statics.findByRole = function(role: string) {
  return this.find({ role, isActive: true });
};

// Virtual fields
userSchema.virtual('fullName').get(function() {
  if (this.profile?.firstName && this.profile?.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.email;
});

userSchema.virtual('isStaff').get(function() {
  return ['staff', 'manager', 'admin'].includes(this.role);
});

export const User = mongoose.models.User || mongoose.model<IUserDocument>('User', userSchema);
export default User;