-- Trigger function to update stock when an order is created
CREATE OR REPLACE FUNCTION update_stock_after_order()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Always decrement the main cached stock in 'products' table
  -- This ensures the total count on the card is always correct
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;

  -- 2. If the item has a specific size, ALSO decrement the size stock
  IF NEW.size_id IS NOT NULL THEN
    UPDATE product_sizes
    SET stock = stock - NEW.quantity
    WHERE id = NEW.size_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_update_stock_after_order ON order_items;

CREATE TRIGGER trigger_update_stock_after_order
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_order();
