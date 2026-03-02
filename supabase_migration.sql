-- ==========================================================
-- SOLUCIÓN: PERMITIR A CAJEROS CREAR Y MODIFICAR PRODUCTOS
-- ==========================================================
-- Este script agrega las políticas de Row Level Security (RLS) necesarias 
-- en la tabla "products" para que el rol "cashier" pueda insertar y actualizar,
-- sin sobreescribir las reglas existentes para los administradores.

-- 1. Política para permitir INSERT a los Cajeros
CREATE POLICY "Manage Products Cashier Insert" ON public.products 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role = 'cashier')
);

-- 2. Política para permitir UPDATE a los Cajeros
CREATE POLICY "Manage Products Cashier Update" ON public.products 
FOR UPDATE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role = 'cashier')
);

-- Nota: No se agrega política de DELETE porque los cajeros 
-- no deberían poder eliminar productos permanentes del sistema.
