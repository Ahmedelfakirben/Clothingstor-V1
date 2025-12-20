-- Script SQL para agregar la columna 'language' a la tabla 'company_settings'
-- Este script debe ejecutarse en Supabase SQL Editor

-- 1. Agregar la columna 'language' a la tabla 'company_settings'
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS language VARCHAR(2) DEFAULT 'es' CHECK (language IN ('es', 'fr'));

-- 2. Actualizar el registro existente con el idioma por defecto (español)
UPDATE company_settings
SET language = 'es'
WHERE language IS NULL;

-- 3. Habilitar Row Level Security (RLS) para la tabla si aún no está habilitada
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- 4. Crear política para que todos los usuarios autenticados puedan LEER la configuración
DROP POLICY IF EXISTS "Allow authenticated users to read company settings" ON company_settings;
CREATE POLICY "Allow authenticated users to read company settings"
ON company_settings
FOR SELECT
TO authenticated
USING (true);

-- 5. Crear política para que solo super_admin pueda ACTUALIZAR la configuración
DROP POLICY IF EXISTS "Allow super_admin to update company settings" ON company_settings;
CREATE POLICY "Allow super_admin to update company settings"
ON company_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE employee_profiles.id = auth.uid()
    AND employee_profiles.role = 'super_admin'
  )
);

-- 6. Habilitar Realtime para la tabla company_settings (para sincronización en tiempo real)
-- Nota: Esto debe ejecutarse en el dashboard de Supabase > Database > Replication
-- O puedes ejecutar este comando SQL si tienes permisos:
ALTER PUBLICATION supabase_realtime ADD TABLE company_settings;

-- Verificar que la columna se agregó correctamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'company_settings'
AND column_name = 'language';
