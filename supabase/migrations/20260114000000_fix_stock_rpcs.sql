-- ==============================================================================
-- FIX: Create RPCs for stock deduction (SECURITY DEFINER) to avoid RLS issues
-- and double deduction from frontend fallbacks.
-- ==============================================================================

-- 1. Decrement stock for SIZED products
CREATE OR REPLACE FUNCTION decrement_product_size_stock(p_size_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Perform atomic update
  UPDATE product_sizes
  SET stock = stock - p_quantity
  WHERE id = p_size_id;
  
  -- Prevent negative stock (optional, but good for data integrity)
  -- If you want to allow negative stock, remove this check.
  -- For now, we trust the frontend check but database won't error if it goes negative unless there is a constraint.
END;
$$;

-- 2. Decrement stock for SIMPLE products (no size)
CREATE OR REPLACE FUNCTION decrement_product_stock(p_product_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Perform atomic update
  UPDATE products
  SET stock = stock - p_quantity
  WHERE id = p_product_id;
END;
$$;

-- Grant execute permissions to authenticated users (so cashiers can use it)
GRANT EXECUTE ON FUNCTION decrement_product_size_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated;
