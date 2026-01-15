/**
 * Global Type Definitions for Jewellery E-commerce Platform
 */

// ============= Product Types =============
export interface Product {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  metal_type: MetalType;
  metal_purity: MetalPurity;
  weight_grams: number;
  stone_weight?: number; // Diamond/stone weight in carats
  price: number;
  mrp: number;
  making_charges_saved: number;
  images: string[]; // Array of image URLs
  stock_quantity: number;
  is_active: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export type ProductCategory =
  | "ring"
  | "necklace"
  | "earring"
  | "bracelet"
  | "pendant"
  | "chain"
  | "bangle"
  | "anklet";

export type MetalType =
  | "gold"
  | "silver"
  | "platinum"
  | "white_gold"
  | "rose_gold";

export type MetalPurity =
  | "24k"
  | "22k"
  | "18k"
  | "14k"
  | "925_silver"
  | "950_platinum";

// ============= Order Types =============
export interface Order {
  id: string;
  order_number: string;
  customer_email: string;
  customer_phone: string;
  customer_name: string;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  total_savings: number;
  shipping_cost: number;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_id?: string;
  payment_method?: string;
  order_status: OrderStatus;
  tracking_number?: string;
  shipping_provider?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  weight_grams: number;
  making_charges_saved: number;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export type PaymentStatus = "pending" | "paid" | "completed" | "failed" | "refunded" | "payment_failed";
export type OrderStatus =
  | "placed"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "payment_failed";

// ============= Cart Types =============
export interface CartItem {
  product: Product;
  quantity: number;
}

// ============= Custom Request Types =============
export interface CustomRequest {
  id: string;
  customer_email: string;
  customer_phone: string;
  customer_name?: string;
  image_url: string;
  description: string;
  status: CustomRequestStatus;
  admin_response?: string;
  estimated_price?: number;
  created_at: string;
  updated_at: string;
}

export type CustomRequestStatus =
  | "pending"
  | "reviewed"
  | "quoted"
  | "declined";

// ============= User Profile Types =============
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  saved_addresses: ShippingAddress[];
  role: UserRole;
  is_admin: "true" | "false";
  created_at: string;
  updated_at: string;
}

export type UserRole = "customer" | "admin" | "super_admin";

// ============= Admin Log Types =============
export interface AdminLog {
  id: string;
  admin_email: string;
  action_type: AdminActionType;
  entity_type: "product" | "order" | "request";
  entity_id: string;
  details: Record<string, any>;
  timestamp: string;
}

export type AdminActionType =
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "order_updated"
  | "request_responded";

// ============= Form Types =============
export interface CheckoutFormData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: ShippingAddress;
}

export interface ProductFormData {
  name: string;
  description: string;
  category: ProductCategory;
  metal_type: MetalType;
  metal_purity: MetalPurity;
  weight_grams: number;
  stone_weight?: number;
  price: number;
  mrp: number;
  making_charges_saved: number;
  images: string[];
  stock_quantity: number;
  is_active: "active" | "inactive";
}

// ============= Filter Types =============
export interface ProductFilters {
  category?: ProductCategory;
  metal_type?: MetalType;
  min_price?: number;
  max_price?: number;
  search?: string;
}

// ============= Response Types =============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
