-- SCHEMA PARA TIENDA DE ROPA
-- Ejecutar estos cambios en tu nueva base de datos Supabase

-- 1. Crear tabla de variantes de producto (talla + color)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  barcode TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Crear tabla de atributos de ropa
CREATE TABLE IF NOT EXISTS clothing_attributes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  gender TEXT CHECK(gender IN ('hombre', 'mujer', 'unisex', 'niño', 'niña')),
  season TEXT CHECK(season IN ('primavera_verano', 'otoño_invierno', 'todo_el_año')),
  material TEXT,
  brand TEXT,
  care_instructions TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear índices para búsquedas rápidas
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_size ON product_variants(size);
CREATE INDEX idx_product_variants_color ON product_variants(color);
CREATE INDEX idx_clothing_attributes_product_id ON clothing_attributes(product_id);
CREATE INDEX idx_clothing_attributes_gender ON clothing_attributes(gender);
CREATE INDEX idx_clothing_attributes_brand ON clothing_attributes(brand);

-- 4. Crear tabla de tallas disponibles (catálogo)
CREATE TABLE IF NOT EXISTS size_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  size_value TEXT NOT NULL,
  size_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category, size_value)
);

-- 5. Insertar tallas comunes
INSERT INTO size_catalog (category, size_value, size_order) VALUES
  -- Ropa general
  ('ropa_general', 'XS', 1),
  ('ropa_general', 'S', 2),
  ('ropa_general', 'M', 3),
  ('ropa_general', 'L', 4),
  ('ropa_general', 'XL', 5),
  ('ropa_general', 'XXL', 6),
  ('ropa_general', 'XXXL', 7),

  -- Pantalones (hombre)
  ('pantalones_hombre', '28', 1),
  ('pantalones_hombre', '30', 2),
  ('pantalones_hombre', '32', 3),
  ('pantalones_hombre', '34', 4),
  ('pantalones_hombre', '36', 5),
  ('pantalones_hombre', '38', 6),
  ('pantalones_hombre', '40', 7),

  -- Pantalones (mujer)
  ('pantalones_mujer', '24', 1),
  ('pantalones_mujer', '26', 2),
  ('pantalones_mujer', '28', 3),
  ('pantalones_mujer', '30', 4),
  ('pantalones_mujer', '32', 5),
  ('pantalones_mujer', '34', 6),

  -- Calzado
  ('calzado', '35', 1),
  ('calzado', '36', 2),
  ('calzado', '37', 3),
  ('calzado', '38', 4),
  ('calzado', '39', 5),
  ('calzado', '40', 6),
  ('calzado', '41', 7),
  ('calzado', '42', 8),
  ('calzado', '43', 9),
  ('calzado', '44', 10),
  ('calzado', '45', 11),

  -- Niños por edad
  ('niños', '2-3 años', 1),
  ('niños', '4-5 años', 2),
  ('niños', '6-7 años', 3),
  ('niños', '8-9 años', 4),
  ('niños', '10-11 años', 5),
  ('niños', '12-13 años', 6);

-- 6. Crear tabla de colores disponibles
CREATE TABLE IF NOT EXISTS color_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  hex_code TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Insertar colores comunes
INSERT INTO color_catalog (name, hex_code) VALUES
  ('Blanco', '#FFFFFF'),
  ('Negro', '#000000'),
  ('Gris', '#808080'),
  ('Azul Marino', '#000080'),
  ('Azul', '#0000FF'),
  ('Rojo', '#FF0000'),
  ('Verde', '#008000'),
  ('Amarillo', '#FFFF00'),
  ('Rosa', '#FFC0CB'),
  ('Morado', '#800080'),
  ('Naranja', '#FFA500'),
  ('Beige', '#F5F5DC'),
  ('Marrón', '#8B4513'),
  ('Turquesa', '#40E0D0'),
  ('Coral', '#FF7F50'),
  ('Vino', '#722F37');

-- 8. Modificar tabla de order_items para incluir variantes
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id),
ADD COLUMN IF NOT EXISTS size TEXT,
ADD COLUMN IF NOT EXISTS color TEXT;

-- 9. Crear tabla de cambios y devoluciones
CREATE TABLE IF NOT EXISTS returns_exchanges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  order_item_id UUID REFERENCES order_items(id),
  type TEXT CHECK(type IN ('devolucion', 'cambio')) NOT NULL,
  reason TEXT NOT NULL,
  new_variant_id UUID REFERENCES product_variants(id),
  refund_amount DECIMAL(10, 2),
  status TEXT CHECK(status IN ('pendiente', 'aprobado', 'rechazado', 'completado')) DEFAULT 'pendiente',
  processed_by UUID REFERENCES employee_profiles(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. Crear tabla de clientes (opcional pero recomendado para tiendas de ropa)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  loyalty_points INTEGER DEFAULT 0,
  preferred_size TEXT,
  total_purchases DECIMAL(10, 2) DEFAULT 0,
  last_purchase_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. Índices para clientes
CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- 12. Relacionar orders con customers
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- 13. Crear función para actualizar stock de variantes
CREATE OR REPLACE FUNCTION update_variant_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE product_variants
    SET stock = stock - NEW.quantity
    WHERE id = NEW.variant_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE product_variants
    SET stock = stock + OLD.quantity
    WHERE id = OLD.variant_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 14. Crear trigger para actualizar stock automáticamente
DROP TRIGGER IF EXISTS trigger_update_variant_stock ON order_items;
CREATE TRIGGER trigger_update_variant_stock
AFTER INSERT OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_variant_stock();

-- 15. RLS (Row Level Security) para las nuevas tablas
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE clothing_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura (todos los empleados autenticados pueden leer)
CREATE POLICY "Empleados pueden ver variantes"
  ON product_variants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Empleados pueden ver atributos de ropa"
  ON clothing_attributes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Empleados pueden ver devoluciones"
  ON returns_exchanges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Empleados pueden ver clientes"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

-- Políticas de escritura (admin y managers)
CREATE POLICY "Admin puede insertar variantes"
  ON product_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admin puede actualizar variantes"
  ON product_variants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- 16. Crear vista para productos con todas sus variantes
CREATE OR REPLACE VIEW products_with_variants AS
SELECT
  p.id as product_id,
  p.name as product_name,
  p.description,
  p.category_id,
  c.name as category_name,
  p.price as base_price,
  p.image,
  pv.id as variant_id,
  pv.sku,
  pv.size,
  pv.color,
  pv.stock as variant_stock,
  ca.gender,
  ca.season,
  ca.material,
  ca.brand
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
LEFT JOIN clothing_attributes ca ON p.id = ca.product_id
LEFT JOIN categories c ON p.category_id = c.id;

-- 17. Función para obtener stock total de un producto
CREATE OR REPLACE FUNCTION get_product_total_stock(product_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(stock), 0)::INTEGER
  FROM product_variants
  WHERE product_id = product_uuid;
$$ LANGUAGE SQL;

-- 18. Actualizar categorías para ropa
-- Primero eliminar categorías de cafetería si existen
DELETE FROM categories WHERE name IN ('Bebidas Calientes', 'Bebidas Frías', 'Postres', 'Snacks');

-- Insertar categorías de ropa
INSERT INTO categories (name, description) VALUES
  ('Camisetas', 'Camisetas y tops'),
  ('Pantalones', 'Pantalones y jeans'),
  ('Vestidos', 'Vestidos y faldas'),
  ('Chaquetas', 'Chaquetas y abrigos'),
  ('Calzado', 'Zapatos y zapatillas'),
  ('Accesorios', 'Accesorios varios'),
  ('Ropa Deportiva', 'Ropa para deporte'),
  ('Ropa Interior', 'Ropa interior y lencería')
ON CONFLICT (name) DO NOTHING;

-- 19. Crear tabla de promociones específicas para ropa
CREATE TABLE IF NOT EXISTS clothing_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT CHECK(discount_type IN ('porcentaje', 'monto_fijo', '2x1', '3x2')) NOT NULL,
  discount_value DECIMAL(10, 2),
  applies_to TEXT CHECK(applies_to IN ('categoria', 'marca', 'producto', 'todo')) NOT NULL,
  target_id UUID,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 20. Crear tabla de etiquetas de precios generadas
CREATE TABLE IF NOT EXISTS price_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID REFERENCES product_variants(id),
  barcode TEXT NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  printed BOOLEAN DEFAULT false
);

COMMENT ON TABLE product_variants IS 'Variantes de productos (talla + color + stock)';
COMMENT ON TABLE clothing_attributes IS 'Atributos específicos de ropa (género, temporada, material, marca)';
COMMENT ON TABLE returns_exchanges IS 'Registro de cambios y devoluciones';
COMMENT ON TABLE customers IS 'Base de datos de clientes con programa de fidelización';
COMMENT ON TABLE clothing_promotions IS 'Promociones específicas para tienda de ropa';
COMMENT ON TABLE price_tags IS 'Etiquetas de precio generadas para impresión';
