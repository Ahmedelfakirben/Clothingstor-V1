-- ====================================
-- CONFIGURAR STORAGE PARA IMÁGENES DE PRODUCTOS
-- ====================================
-- Este script configura el bucket de almacenamiento para imágenes

-- IMPORTANTE: Este script debe ejecutarse desde el panel de Supabase
-- en Storage > Policies, NO en SQL Editor

-- 1. CREAR EL BUCKET (esto se hace desde la interfaz de Supabase)
--    Ve a Storage > Create bucket
--    Nombre: product-images
--    Público: SÍ (activar)

-- 2. POLÍTICAS DE SEGURIDAD PARA EL BUCKET
-- Después de crear el bucket, ejecuta estas políticas en SQL Editor:

-- Política para LEER imágenes (público)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Política para SUBIR imágenes (solo autenticados)
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Política para ACTUALIZAR imágenes (solo autenticados)
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Política para ELIMINAR imágenes (solo admin y super_admin)
CREATE POLICY "Admins can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE employee_profiles.id = auth.uid()
    AND employee_profiles.role IN ('admin', 'super_admin')
    AND employee_profiles.active = true
    AND employee_profiles.deleted_at IS NULL
  )
);

-- ====================================
-- VERIFICAR POLÍTICAS
-- ====================================
SELECT * FROM storage.policies
WHERE bucket_id = 'product-images';

-- ====================================
-- FIN
-- ====================================
