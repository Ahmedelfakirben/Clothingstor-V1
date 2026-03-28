-- ============================================================
-- MIGRACIÓN: Funciones de devolución de stock + tabla order_returns
-- ============================================================

-- 1. RPC: Incrementar stock de un producto (sin tallas)
CREATE OR REPLACE FUNCTION increment_product_stock(p_product_id uuid, p_quantity integer)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock = COALESCE(stock, 0) + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: Incrementar stock de una talla específica
CREATE OR REPLACE FUNCTION increment_product_size_stock(p_size_id uuid, p_quantity integer)
RETURNS void AS $$
BEGIN
  UPDATE product_sizes
  SET stock = COALESCE(stock, 0) + p_quantity
  WHERE id = p_size_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Tabla para registrar devoluciones (retours)
CREATE TABLE IF NOT EXISTS order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  size_id uuid REFERENCES product_sizes(id) ON DELETE SET NULL,
  quantity_returned integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_refund decimal(10,2) NOT NULL,
  reason text DEFAULT '',
  returned_by uuid REFERENCES auth.users(id),
  withdrawal_id uuid REFERENCES cash_withdrawals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE order_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_returns_all" ON order_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_order_returns_order_id ON order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_order_item ON order_returns(order_item_id);
