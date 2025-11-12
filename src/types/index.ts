import { Document, Types } from 'mongoose';

// Base Document Interface
export interface BaseDocument extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// User Types
export type UserRole = 'customer' | 'staff' | 'manager' | 'admin';

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  preferences?: Record<string, any>;
}

export interface StaffProfile {
  employeeId: string;
  position: string;
  hireDate: Date;
  permissions: string[];
  schedule?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
}

export interface IUser extends BaseDocument {
  email: string;
  password: string;
  role: UserRole;
  profile?: UserProfile;
  staffProfile?: StaffProfile;
  lastLogin?: Date;
  isActive: boolean;
}

// Menu Types
export interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface IMenuItem extends BaseDocument {
  name: string;
  description?: string;
  category: Types.ObjectId;
  price: number;
  images: string[];
  ingredients: string[];
  allergens: string[];
  isAvailable: boolean;
  preparationTime: number;
  nutritionInfo?: NutritionInfo;
  sortOrder: number;
  tags: string[];
}

export interface ICategory extends BaseDocument {
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: Types.ObjectId;
}

// Order Types
export type OrderType = 'dine-in' | 'takeaway' | 'delivery';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet';

export interface OrderItem {
  menuItemId: Types.ObjectId;
  quantity: number;
  price: number;
  customizations?: Record<string, any>;
  specialInstructions?: string;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  postalCode: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface IOrder extends BaseDocument {
  orderNumber: string;
  userId: Types.ObjectId;
  items: OrderItem[];
  orderType: OrderType;
  status: OrderStatus;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  tableNumber?: number;
  deliveryAddress?: DeliveryAddress;
  estimatedTime?: number;
  actualTime?: number;
  completedAt?: Date;
}

// Booking Types
export type BookingStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no-show';

export interface IBooking extends BaseDocument {
  bookingId: string;
  userId: Types.ObjectId;
  tableId: Types.ObjectId;
  date: Date;
  time: string;
  duration: number;
  partySize: number;
  status: BookingStatus;
  specialRequests?: string;
  contactPhone: string;
}

// Table Types
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';
export type TableShape = 'round' | 'square' | 'rectangle';

export interface ITable extends BaseDocument {
  tableNumber: string;
  capacity: number;
  location: string;
  shape: TableShape;
  status: TableStatus;
  currentBooking?: Types.ObjectId;
  qrCode?: string;
}

// Inventory Types
export type StockUnit = 'kg' | 'liters' | 'pieces' | 'boxes';

export interface Supplier {
  name: string;
  contactInfo: string;
  leadTime: number;
}

export interface UsageHistory {
  date: Date;
  quantity: number;
  orderId?: Types.ObjectId;
  reason: string;
}

export interface IInventoryItem extends BaseDocument {
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: StockUnit;
  unitCost: number;
  supplier?: Supplier;
  lastRestocked?: Date;
  usageHistory: UsageHistory[];
  isActive: boolean;
}

// Analytics Types
export interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
}

export interface PopularItem {
  menuItemId: Types.ObjectId;
  name: string;
  quantity: number;
  revenue: number;
}

export interface CustomerStats {
  newCustomers: number;
  returningCustomers: number;
  totalOrders: number;
  averageOrderValue: number;
}

export interface PerformanceMetrics {
  tableTurnoverRate: number;
  averageOrderTime: number;
  customerSatisfaction: number;
  staffProductivity: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface OrderFormData {
  items: OrderItem[];
  orderType: OrderType;
  tableNumber?: number;
  deliveryAddress?: DeliveryAddress;
  specialInstructions?: string;
}

export interface BookingFormData {
  date: string;
  time: string;
  partySize: number;
  specialRequests?: string;
  contactPhone: string;
}

// Real-time Event Types
export interface SocketEvent {
  type: 'order_status_update' | 'new_order' | 'booking_update' | 'table_update';
  data: any;
  timestamp: Date;
}

export interface OrderStatusUpdateEvent extends SocketEvent {
  type: 'order_status_update';
  data: {
    orderId: string;
    newStatus: OrderStatus;
    oldStatus: OrderStatus;
  };
}

export interface NewOrderEvent extends SocketEvent {
  type: 'new_order';
  data: IOrder;
}

export interface BookingUpdateEvent extends SocketEvent {
  type: 'booking_update';
  data: {
    bookingId: string;
    newStatus: BookingStatus;
  };
}

export interface TableUpdateEvent extends SocketEvent {
  type: 'table_update';
  data: {
    tableId: string;
    newStatus: TableStatus;
  };
}