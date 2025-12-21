ALTER TABLE public.product_sizes ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- Optional: Function to calculate total stock
-- This isn't strictly necessary if we handle it in frontend, but good for data integrity
-- For now, we will rely on frontend/backend logic to keep things simple.
