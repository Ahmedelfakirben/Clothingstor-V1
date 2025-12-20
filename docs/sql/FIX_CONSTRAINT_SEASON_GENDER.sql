-- ====================================
-- FIX: ACTUALIZAR CONSTRAINTS DE SEASON Y GENDER
-- ====================================
-- Este script corrige los constraints para que coincidan con el formulario

-- 1. Verificar los constraints actuales
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'products'
AND con.conname LIKE '%season%' OR con.conname LIKE '%gender%';

-- 2. Eliminar el constraint antiguo de season si existe
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_season_check;

-- 3. Eliminar el constraint antiguo de gender si existe
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_gender_check;

-- 4. Crear el nuevo constraint de gender (mismo que antes)
ALTER TABLE products
ADD CONSTRAINT products_gender_check
CHECK (gender IS NULL OR gender IN ('hombre', 'mujer', 'unisex', 'niño', 'niña'));

-- 5. Crear el nuevo constraint de season (valores agrupados para tienda de ropa)
ALTER TABLE products
ADD CONSTRAINT products_season_check
CHECK (season IS NULL OR season IN ('primavera_verano', 'otoño_invierno', 'todo_el_año'));

-- 6. Actualizar productos existentes que tengan valores antiguos (si los hay)
UPDATE products
SET season = CASE
    WHEN season IN ('primavera', 'verano') THEN 'primavera_verano'
    WHEN season IN ('otoño', 'invierno') THEN 'otoño_invierno'
    WHEN season = 'todas' THEN 'todo_el_año'
    ELSE season
END
WHERE season IN ('primavera', 'verano', 'otoño', 'invierno', 'todas');

-- 7. Verificar que los nuevos constraints están correctos
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'products'
AND (con.conname LIKE '%season%' OR con.conname LIKE '%gender%');

-- ====================================
-- FIN
-- ====================================
-- Ahora los valores permitidos son:
-- Gender: 'hombre', 'mujer', 'unisex', 'niño', 'niña'
-- Season: 'primavera_verano', 'otoño_invierno', 'todo_el_año'
