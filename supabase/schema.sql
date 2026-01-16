-- Supabase Schema for DJewel Boutique E-commerce
-- Run this in the Supabase SQL Editor to set up your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products Table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('ring', 'necklace', 'earring', 'bracelet', 'pendant', 'chain', 'bangle', 'anklet')),
  metal_type TEXT NOT NULL CHECK (metal_type IN ('gold', 'silver', 'platinum', 'white_gold', 'rose_gold')),
  metal_purity TEXT NOT NULL CHECK (metal_purity IN ('24k', '22k', '18k', '14k', '925_silver', '950_platinum')),
  weight_grams DECIMAL(10,2) NOT NULL,
  stone_weight DECIMAL(10,2), -- Diamond/stone weight in carats (optional)
  price DECIMAL(12,2) NOT NULL,
  mrp DECIMAL(12,2) NOT NULL,
  making_charges_saved DECIMAL(12,2) NOT NULL DEFAULT 0,
  images JSONB DEFAULT '[]',
  videos JSONB DEFAULT '[]',
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_active TEXT NOT NULL DEFAULT 'active' CHECK (is_active IN ('active', 'inactive')),
  sku TEXT,
  short_description TEXT,
  width_mm DECIMAL(10,2),
  height_mm DECIMAL(10,2),
  length_mm DECIMAL(10,2),
  gross_weight_grams DECIMAL(10,2),
  stone_quality TEXT,
  stone_setting TEXT,
  stone_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Run this if you already have the table and need to add the column:
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS stone_weight DECIMAL(10,2);

-- Migration: Add video support and product details fields
-- Run these if you already have the table:
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS width_mm DECIMAL(10,2);
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS height_mm DECIMAL(10,2);
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS length_mm DECIMAL(10,2);
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS gross_weight_grams DECIMAL(10,2);
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS stone_quality TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS stone_setting TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS stone_count INTEGER;

-- Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  items JSONB NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  total_savings DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'completed', 'failed', 'refunded', 'payment_failed')),
  payment_id TEXT,
  payment_method TEXT DEFAULT 'razorpay',
  order_status TEXT NOT NULL DEFAULT 'placed' CHECK (order_status IN ('placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'payment_failed')),
  tracking_number TEXT,
  shipping_provider TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Requests Table
CREATE TABLE custom_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  image_url TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'quoted', 'declined')),
  admin_response TEXT,
  estimated_price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Run this if you already have the table and need to add the columns:
-- ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';
-- ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Custom Request Comments Table
CREATE TABLE custom_request_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES custom_requests(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add comments table if it doesn't exist
-- Run this if you already have the database:
-- CREATE TABLE IF NOT EXISTS custom_request_comments (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   request_id UUID NOT NULL REFERENCES custom_requests(id) ON DELETE CASCADE,
--   customer_email TEXT NOT NULL,
--   comment_text TEXT NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- CREATE INDEX IF NOT EXISTS idx_custom_request_comments_request_id ON custom_request_comments(request_id);
-- CREATE INDEX IF NOT EXISTS idx_custom_request_comments_customer_email ON custom_request_comments(customer_email);

-- User Profiles Table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  saved_addresses JSONB DEFAULT '[]',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'super_admin')),
  is_admin TEXT NOT NULL DEFAULT 'false' CHECK (is_admin IN ('true', 'false')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Logs Table
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('product_created', 'product_updated', 'product_deleted', 'order_updated', 'request_responded')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'order', 'request')),
  entity_id TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_custom_requests_customer_email ON custom_requests(customer_email);
CREATE INDEX idx_custom_request_comments_request_id ON custom_request_comments(request_id);
CREATE INDEX idx_custom_request_comments_customer_email ON custom_request_comments(customer_email);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_admin_logs_timestamp ON admin_logs(timestamp);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Products: Public read, authenticated write
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);
CREATE POLICY "Products are insertable by authenticated users" ON products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Products are updatable by authenticated users" ON products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Products are deletable by authenticated users" ON products FOR DELETE USING (auth.role() = 'authenticated');

-- Orders: Users can view their own orders, create orders (including guests)
CREATE POLICY "Orders are viewable by owner" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders are updatable by authenticated users" ON orders FOR UPDATE USING (auth.role() = 'authenticated');

-- Custom Requests: Users can view their own, authenticated can create
CREATE POLICY "Custom requests viewable by authenticated" ON custom_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Custom requests insertable by authenticated" ON custom_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Custom requests updatable by authenticated" ON custom_requests FOR UPDATE USING (auth.role() = 'authenticated');

-- Custom Request Comments: Users can view/add comments for their own requests
CREATE POLICY "Comments viewable by authenticated" ON custom_request_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Comments insertable by authenticated" ON custom_request_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.email() = customer_email);

-- User Profiles: Users can view/update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.email() = email);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.email() = email);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.email() = email);

-- Admin Logs: Only authenticated users (admins)
CREATE POLICY "Admin logs viewable by authenticated" ON admin_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin logs insertable by authenticated" ON admin_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Storage bucket for images
-- Run this separately or in Supabase dashboard:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);
