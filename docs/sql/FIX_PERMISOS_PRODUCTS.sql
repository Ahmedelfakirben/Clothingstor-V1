-- ====================================
-- FIX: PERMISOS RLS PARA TABLA PRODUCTS
-- ====================================
-- Ejecuta este script si tienes errores al crear/editar productos

-- 1. Ver las políticas actuales
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'products';

-- 2. Eliminar políticas antiguas (si existen)
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Admin can insert products" ON products;
DROP POLICY IF EXISTS "Admin can update products" ON products;
DROP POLICY IF EXISTS "Admin can delete products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- 3. Crear políticas correctas

-- Política de SELECT: Cualquier usuario autenticado puede ver productos
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- Política de INSERT: Solo admin y super_admin pueden crear productos
CREATE POLICY "Admin can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND active = true
      AND deleted_at IS NULL
    )
  );

-- Política de UPDATE: Solo admin y super_admin pueden actualizar productos
CREATE POLICY "Admin can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND active = true
      AND deleted_at IS NULL
    )
  );

-- Política de DELETE: Solo admin y super_admin pueden eliminar productos
CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND active = true
      AND deleted_at IS NULL
    )
  );

-- 4. Verificar que el RLS está habilitado
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 5. Verificar la estructura de la tabla products
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 6. Verificar el perfil del usuario actual (ejecuta esto para ver tu rol)
SELECT
    id,
    email,
    full_name,
    role,
    active,
    deleted_at
FROM employee_profiles
WHERE id = auth.uid();

-- ====================================
-- FIN
-- ====================================
-- Si después de ejecutar esto sigues teniendo problemas:
-- 1. Verifica que tu usuario tenga rol 'admin' o 'super_admin'
-- 2. Verifica que active = true
-- 3. Verifica que deleted_at IS NULL
-- 4. Revisa la consola del navegador para ver logs detallados
