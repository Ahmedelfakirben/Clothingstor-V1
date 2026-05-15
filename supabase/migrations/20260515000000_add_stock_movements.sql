-- ============================================================
-- MIGRACIÓN: Tabla de movimientos de stock
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  size_id uuid REFERENCES public.product_sizes(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  type text NOT NULL CHECK (type IN ('manual_add', 'manual_deduct', 'sale', 'return', 'correction')),
  reason text DEFAULT '',
  employee_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_all" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
