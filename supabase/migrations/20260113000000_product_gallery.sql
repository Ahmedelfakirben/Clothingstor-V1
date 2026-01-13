-- Tabla para galería de imágenes de productos
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (RLS)
-- Todos pueden ver las imágenes
CREATE POLICY "View Product Images All" ON product_images FOR SELECT TO authenticated USING (true);

-- Empleados pueden gestionar imágenes (Insertar)
CREATE POLICY "Manage Product Images Insert" ON product_images FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'cashier'))
);

-- Empleados pueden gestionar imágenes (Actualizar)
CREATE POLICY "Manage Product Images Update" ON product_images FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'cashier'))
);

-- Empleados pueden gestionar imágenes (Borrar)
CREATE POLICY "Manage Product Images Delete" ON product_images FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'cashier'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
