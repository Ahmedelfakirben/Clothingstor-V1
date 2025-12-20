-- ====================================
-- FIX: AGREGAR COLUMNAS FALTANTES
-- ====================================
-- Ejecuta este script si ya ejecutaste la migración principal
-- y te aparecen errores de columnas faltantes

-- 1. Agregar columnas a employee_profiles (is_online, last_login)
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login timestamptz;

-- 2. Agregar columnas a company_settings (language, theme)
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS language VARCHAR(2) DEFAULT 'es' CHECK (language IN ('es', 'fr', 'en')),
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'fashion' CHECK (theme IN ('amber', 'dark', 'blue', 'green', 'fashion'));

-- 3. Agregar columnas a products (brand, material, gender, season, stock)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS material TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK(gender IN ('hombre', 'mujer', 'unisex', 'niño', 'niña')),
ADD COLUMN IF NOT EXISTS season TEXT CHECK(season IN ('primavera_verano', 'otoño_invierno', 'todo_el_año')),
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- 4. Crear índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_season ON products(season);

-- 5. Actualizar company_settings existente con valores por defecto
UPDATE company_settings
SET
  language = COALESCE(language, 'es'),
  theme = COALESCE(theme, 'fashion')
WHERE language IS NULL OR theme IS NULL;

-- ====================================
-- FIN
-- ====================================
-- Ahora recarga la aplicación y debería funcionar correctamente
