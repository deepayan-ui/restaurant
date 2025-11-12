export { default as User, IUserDocument } from './User';
export { default as Category } from './Category';
export { default as MenuItem } from './MenuItem';
export { default as Table } from './Table';
export { default as Order } from './Order';
export { default as Booking } from './Booking';
export { default as InventoryItem } from './InventoryItem';

// Re-export types for convenience
export type {
  IUser,
  UserRole,
  UserProfile,
  StaffProfile,
  IMenuItem,
  ICategory,
  ITable,
  IOrder,
  IBooking,
  IInventoryItem,
  OrderItem,
  DeliveryAddress,
  Supplier,
  UsageHistory
} from '@/types';