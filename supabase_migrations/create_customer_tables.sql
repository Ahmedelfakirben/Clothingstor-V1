-- Migration: Create customer tables for e-commerce shop
-- This migration adds new tables for customer authentication and online orders
-- It does NOT modify any existing POS tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customer profiles table (separate from employee_profiles)
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  default_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Online orders table (separate from POS orders)
CREATE TABLE IF NOT EXISTS online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL,
  customer_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- Status: pending, confirmed, preparing, ready, shipped, delivered, cancelled
  delivery_address TEXT,
  delivery_notes TEXT,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items for online orders
CREATE TABLE IF NOT EXISTS order_items_online (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES online_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, -- Store name in case product is deleted
  product_size TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_online_orders_customer ON online_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_online_orders_created ON online_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_online_order ON order_items_online(order_id);

-- Enable Row Level Security
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items_online ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_profiles
CREATE POLICY "Customers can view own profile"
  ON customer_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Customers can update own profile"
  ON customer_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Customers can insert own profile"
  ON customer_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for online_orders
CREATE POLICY "Customers can view own orders"
  ON online_orders FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create orders"
  ON online_orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Employees can view all online orders
CREATE POLICY "Employees can view all online orders"
  ON online_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles 
      WHERE id = auth.uid()
    )
  );

-- Employees can update online orders (change status, etc.)
CREATE POLICY "Employees can update online orders"
  ON online_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles 
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for order_items_online
CREATE POLICY "Users can view order items for their orders"
  ON order_items_online FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM online_orders 
      WHERE id = order_id 
      AND (customer_id = auth.uid() OR EXISTS (
        SELECT 1 FROM employee_profiles WHERE id = auth.uid()
      ))
    )
  );

CREATE POLICY "Customers can insert order items"
  ON order_items_online FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM online_orders 
      WHERE id = order_id 
      AND customer_id = auth.uid()
    )
  );

-- Allow public read access to active products (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' 
    AND policyname = 'Public can view active products'
  ) THEN
    CREATE POLICY "Public can view active products"
      ON products FOR SELECT
      USING (available = true);
  END IF;
END $$;

-- Allow public read access to categories (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'categories' 
    AND policyname = 'Public can view categories'
  ) THEN
    CREATE POLICY "Public can view categories"
      ON categories FOR SELECT
      USING (true);
  END IF;
END $$;

-- Allow public read access to product_sizes (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'product_sizes' 
    AND policyname = 'Public can view product sizes'
  ) THEN
    CREATE POLICY "Public can view product sizes"
      ON product_sizes FOR SELECT
      USING (true);
  END IF;
END $$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for customer_profiles
CREATE TRIGGER update_customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for online_orders
CREATE TRIGGER update_online_orders_updated_at
  BEFORE UPDATE ON online_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
