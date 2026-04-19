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
  videos?: string[]; // Array of video URLs
  stock_quantity: number;
  is_active: "active" | "inactive";
  sku?: string; // Stock Keeping Unit
  short_description?: string; // Short product description
  width_mm?: number; // Width in millimeters
  height_mm?: number; // Height in millimeters
  length_mm?: number; // Length in millimeters
  gross_weight_grams?: number; // Gross weight including stones
  stone_quality?: string; // Stone quality (e.g., "FG-SI")
  stone_grade?: string; // Stone grade/clarity (e.g., "FG-SI", "VS", "VVS")
  stone_setting?: string; // Stone setting type (e.g., "Hand Setting", "Prong Setting", "Bezel Setting")
  stone_count?: number; // Number of diamonds/stones
  // MTO fields (Feature 2, Phase 1)
  allow_mto?: boolean;
  mto_lead_time_weeks?: number;
  mto_deposit_pct?: number;
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
  | "payment_failed"
  | "mto_awaiting_deposit"
  | "mto_in_production"
  | "mto_ready_for_dispatch";

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
  entity_type: "product" | "order" | "request" | "vendor" | "job" | "milestone";
  entity_id: string;
  details: Record<string, any>;
  timestamp: string;
}

export type AdminActionType =
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "order_updated"
  | "request_responded"
  | "vendor_created"
  | "vendor_updated"
  | "job_created"
  | "job_status_changed"
  | "milestone_updated";

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
  videos?: string[];
  stock_quantity: number;
  is_active: "active" | "inactive";
  sku?: string;
  short_description?: string;
  width_mm?: number;
  height_mm?: number;
  length_mm?: number;
  gross_weight_grams?: number;
  stone_quality?: string;
  stone_grade?: string;
  stone_setting?: string;
  stone_count?: number;
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

// ============= Vendor Types (Feature 2) =============
export type VendorSpecialty = "casting" | "stone_setting" | "polishing" | "cad" | "engraving" | "assembly";

export interface Vendor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  specialties: VendorSpecialty[];
  reliability_score: number;
  active: boolean;
  address?: Record<string, string>;
  notes?: string;
  created_at: string;
}

// ============= Custom Job Types (Feature 2, Phase 2) =============
export type CustomJobStatus =
  | "intake" | "design" | "quoted" | "approved" | "deposit_pending"
  | "in_production" | "qc" | "ready_for_dispatch" | "dispatched"
  | "delivered" | "cancelled" | "on_hold";

export type MilestoneName =
  | "design_approved" | "cad_ready" | "wax_model" | "casting"
  | "stone_setting" | "finishing" | "qc" | "ready";

export interface CustomJob {
  id: string;
  job_number: string;
  source: "custom_request" | "mto" | "admin_manual";
  custom_request_id?: string;
  product_id?: string;
  order_id?: string;
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  vendor_id?: string;
  title: string;
  specification: Record<string, unknown>;
  status: CustomJobStatus;
  deposit_amount: number;
  deposit_paid: boolean;
  final_amount: number;
  final_paid: boolean;
  estimated_ready_date?: string;
  actual_ready_date?: string;
  tracking_token: string;
  created_at: string;
  updated_at: string;
}

export interface CustomJobMilestone {
  id: string;
  job_id: string;
  milestone: MilestoneName;
  status: "pending" | "in_progress" | "done" | "skipped";
  photos: string[];
  note?: string;
  completed_at?: string;
  completed_by?: string;
}

export interface CustomJobDetail extends CustomJob {
  vendor?: Vendor;
  milestones: CustomJobMilestone[];
}

export interface CustomJobPublic {
  id: string;
  job_number: string;
  title: string;
  status: CustomJobStatus;
  estimated_ready_date?: string;
  deposit_amount: number;
  final_amount: number;
  milestones: Pick<CustomJobMilestone, "milestone" | "status" | "photos" | "completed_at">[];
}
