-- Add address fields to customer_profiles table
ALTER TABLE customer_profiles
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Add comment
COMMENT ON COLUMN customer_profiles.address IS 'Customer full address';
COMMENT ON COLUMN customer_profiles.city IS 'Customer city';
COMMENT ON COLUMN customer_profiles.postal_code IS 'Customer postal code';
