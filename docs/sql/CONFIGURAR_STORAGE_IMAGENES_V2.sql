-- ====================================
-- CONFIGURAR STORAGE PARA IMÁGENES DE PRODUCTOS
-- ====================================
-- IMPORTANTE: Primero debes crear el bucket desde la interfaz
-- Ve a Storage > Create bucket > Nombre: "product-images" > Public: SÍ

-- Luego ejecuta estas políticas:

-- 1. Política para LEER imágenes (público)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- 2. Política para SUBIR imágenes (solo autenticados)
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- 3. Política para ACTUALIZAR imágenes (solo autenticados)
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- 4. Política para ELIMINAR imágenes (solo admin y super_admin)
DROP POLICY IF EXISTS "Admins can delete images" ON storage.objects;
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
-- FIN - Recarga la aplicación y prueba subir una imagen
-- ====================================
