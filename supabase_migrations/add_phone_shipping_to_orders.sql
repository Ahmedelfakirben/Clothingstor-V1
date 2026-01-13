-- Migration: Add phone and shipping_address columns to online_orders
-- This adds the missing columns that the checkout page expects

-- Add phone column to store customer phone number
ALTER TABLE online_orders 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add shipping_address column to store shipping address
ALTER TABLE online_orders 
ADD COLUMN IF NOT EXISTS shipping_address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN online_orders.phone IS 'Customer phone number for order contact';
COMMENT ON COLUMN online_orders.shipping_address IS 'Full shipping address for the order';
