-- ====================================
-- VERIFICAR CONFIGURACIÓN DE TEMA
-- ====================================
-- Ejecuta este script para verificar que la configuración del tema
-- está correcta en la base de datos

-- 1. Ver el estado actual de company_settings
SELECT id, company_name, theme, language
FROM company_settings;

-- 2. Si no hay tema configurado o es NULL, actualizarlo a 'fashion'
UPDATE company_settings
SET theme = 'fashion'
WHERE theme IS NULL OR theme = '';

-- 3. Verificar que los permisos RLS están correctos para company_settings
SELECT * FROM pg_policies
WHERE tablename = 'company_settings';

-- 4. Verificar que la columna theme existe y tiene el tipo correcto
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'company_settings'
AND column_name = 'theme';

-- 5. Si los permisos están mal, ejecutar esto:
-- (Descomenta solo si es necesario)

-- DROP POLICY IF EXISTS "Allow authenticated users to read company settings" ON company_settings;
-- DROP POLICY IF EXISTS "Allow super_admin to update company settings" ON company_settings;

-- CREATE POLICY "Allow authenticated users to read company settings"
-- ON company_settings
-- FOR SELECT
-- TO authenticated
-- USING (true);

-- CREATE POLICY "Allow super_admin to update company settings"
-- ON company_settings
-- FOR UPDATE
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM employee_profiles
--     WHERE employee_profiles.id = auth.uid()
--     AND employee_profiles.role = 'super_admin'
--   )
-- );

-- ====================================
-- FIN
-- ====================================
