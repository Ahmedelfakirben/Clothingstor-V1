-- ====================================
-- TABLA PARA CACHÉ DE CÓDIGOS DE BARRAS
-- ====================================
-- Esta tabla almacena información de productos obtenida de APIs externas
-- para evitar consultas repetidas y mejorar el rendimiento
-- ====================================

CREATE TABLE IF NOT EXISTS barcode_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text UNIQUE NOT NULL,
  product_name text,
  brand text,
  description text,
  category text,
  image_url text,
  api_source text DEFAULT 'ean-search', -- 'ean-search', 'barcode-spider', etc.
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Índice para búsquedas rápidas por código de barras
CREATE INDEX IF NOT EXISTS idx_barcode ON barcode_cache(barcode);

-- Índice para limpiar caché antiguo
CREATE INDEX IF NOT EXISTS idx_last_updated ON barcode_cache(last_updated);

-- Habilitar RLS
ALTER TABLE barcode_cache ENABLE ROW LEVEL SECURITY;

-- Política: Todos los usuarios autenticados pueden leer
CREATE POLICY "Authenticated users can read barcode cache"
ON barcode_cache
FOR SELECT
TO authenticated
USING (true);

-- Política: Todos los usuarios autenticados pueden insertar
CREATE POLICY "Authenticated users can insert barcode cache"
ON barcode_cache
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política: Todos los usuarios autenticados pueden actualizar
CREATE POLICY "Authenticated users can update barcode cache"
ON barcode_cache
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Comentario
COMMENT ON TABLE barcode_cache IS 
'Caché de información de productos obtenida de APIs externas de códigos de barras. Mejora el rendimiento y reduce llamadas a APIs externas.';

-- Función para limpiar caché antiguo (opcional, ejecutar manualmente o con cron)
CREATE OR REPLACE FUNCTION clean_old_barcode_cache()
RETURNS void AS $$
BEGIN
  -- Eliminar registros más antiguos de 6 meses
  DELETE FROM barcode_cache
  WHERE last_updated < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clean_old_barcode_cache() IS 
'Elimina registros de caché de códigos de barras más antiguos de 6 meses para mantener la base de datos limpia.';
