-- Trigger function to update stock when an order is created OR deleted
CREATE OR REPLACE FUNCTION update_stock_after_order()
RETURNS TRIGGER AS $func$
BEGIN
  -- Handle INSERT (Order Created) -> Decrease Stock
  IF (TG_OP = 'INSERT') THEN
    UPDATE products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id;

    IF NEW.size_id IS NOT NULL THEN
      UPDATE product_sizes
      SET stock = stock - NEW.quantity
      WHERE id = NEW.size_id;
    END IF;
    
    RETURN NEW;
    
  -- Handle DELETE (Order Cancelled/Deleted) -> Increase Stock
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE products
    SET stock = stock + OLD.quantity
    WHERE id = OLD.product_id;

    IF OLD.size_id IS NOT NULL THEN
      UPDATE product_sizes
      SET stock = stock + OLD.quantity
      WHERE id = OLD.size_id;
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$func$ LANGUAGE plpgsql;

-- Re-create the trigger to fire on both INSERT and DELETE
DROP TRIGGER IF EXISTS trigger_update_stock_after_order ON order_items;

CREATE TRIGGER trigger_update_stock_after_order
AFTER INSERT OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_order();
