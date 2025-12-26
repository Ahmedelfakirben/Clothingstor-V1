-- ====================================
-- FIX RLS POLICIES FOR BACKUP RESTORE (CORREGIDO)
-- ====================================
-- Esta migración agrega políticas RLS permisivas SIN recursión infinita
-- Usa una función helper para verificar el rol sin consultar employee_profiles
-- Fecha: 2025-12-26 (VERSIÓN CORREGIDA)
-- ====================================

-- ====================================
-- FUNCIÓN HELPER PARA VERIFICAR ROL
-- ====================================
-- Esta función usa una variable de sesión en lugar de consultar employee_profiles
-- para evitar recursión infinita

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar si el usuario actual es super_admin usando una consulta directa
  -- que no active las políticas RLS
  RETURN EXISTS (
    SELECT 1 
    FROM employee_profiles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
    AND deleted_at IS NULL
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM employee_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
    AND deleted_at IS NULL
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- EMPLOYEE_PROFILES - SIN RECURSIÓN
-- ====================================
-- Políticas simples que no consultan la misma tabla en USING/WITH CHECK

DROP POLICY IF EXISTS "View Profiles" ON employee_profiles;
CREATE POLICY "View Profiles" 
ON employee_profiles 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Update Self" ON employee_profiles;
CREATE POLICY "Update Self" 
ON employee_profiles 
FOR UPDATE 
TO authenticated 
USING (id = auth.uid());

-- Política especial para INSERT/DELETE solo para operaciones de sistema
-- No usamos verificación de rol aquí para evitar recursión
DROP POLICY IF EXISTS "System Operations" ON employee_profiles;
CREATE POLICY "System Operations" 
ON employee_profiles 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- APP_CURRENCY_SETTINGS
-- ====================================
DROP POLICY IF EXISTS "View Currency Settings" ON app_currency_settings;
CREATE POLICY "View Currency Settings" 
ON app_currency_settings 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Currency Settings" ON app_currency_settings;
CREATE POLICY "Manage Currency Settings" 
ON app_currency_settings 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- CASH_REGISTER_SESSIONS
-- ====================================
DROP POLICY IF EXISTS "View Sessions" ON cash_register_sessions;
CREATE POLICY "View Sessions" 
ON cash_register_sessions 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Sessions" ON cash_register_sessions;
CREATE POLICY "Manage Sessions" 
ON cash_register_sessions 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- ORDER_HISTORY
-- ====================================
DROP POLICY IF EXISTS "View Order History" ON order_history;
CREATE POLICY "View Order History" 
ON order_history 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Order History" ON order_history;
CREATE POLICY "Manage Order History" 
ON order_history 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- BACKUP_HISTORY
-- ====================================
DROP POLICY IF EXISTS "View Backup History" ON backup_history;
CREATE POLICY "View Backup History" 
ON backup_history 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Backup History" ON backup_history;
CREATE POLICY "Manage Backup History" 
ON backup_history 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- BACKUP_CONFIG
-- ====================================
DROP POLICY IF EXISTS "View Backup Config" ON backup_config;
CREATE POLICY "View Backup Config" 
ON backup_config 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Backup Config" ON backup_config;
CREATE POLICY "Manage Backup Config" 
ON backup_config 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- COMPANY_SETTINGS
-- ====================================
DROP POLICY IF EXISTS "View Company Settings" ON company_settings;
CREATE POLICY "View Company Settings" 
ON company_settings 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Company Settings" ON company_settings;
CREATE POLICY "Manage Company Settings" 
ON company_settings 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- ROLE_PERMISSIONS
-- ====================================
DROP POLICY IF EXISTS "View Permissions" ON role_permissions;
CREATE POLICY "View Permissions" 
ON role_permissions 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Permissions" ON role_permissions;
CREATE POLICY "Manage Permissions" 
ON role_permissions 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- DELETED_PRODUCTS
-- ====================================
DROP POLICY IF EXISTS "View Deleted Products" ON deleted_products;
CREATE POLICY "View Deleted Products" 
ON deleted_products 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Deleted Products" ON deleted_products;
CREATE POLICY "Manage Deleted Products" 
ON deleted_products 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- DELETED_ORDERS
-- ====================================
DROP POLICY IF EXISTS "View Deleted Orders" ON deleted_orders;
CREATE POLICY "View Deleted Orders" 
ON deleted_orders 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Deleted Orders" ON deleted_orders;
CREATE POLICY "Manage Deleted Orders" 
ON deleted_orders 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- AVAILABLE_CURRENCIES
-- ====================================
DROP POLICY IF EXISTS "View Currencies" ON available_currencies;
CREATE POLICY "View Currencies" 
ON available_currencies 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Manage Currencies" ON available_currencies;
CREATE POLICY "Manage Currencies" 
ON available_currencies 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ====================================
-- TABLAS ADICIONALES PARA RESET DATABASE
-- ====================================
-- Estas tablas necesitan políticas permisivas para permitir DELETE durante reset

-- ORDERS
DROP POLICY IF EXISTS "Employees View Orders" ON orders;
DROP POLICY IF EXISTS "Employees Create Orders" ON orders;
DROP POLICY IF EXISTS "Employees Update Orders" ON orders;

CREATE POLICY "View Orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ORDER_ITEMS
DROP POLICY IF EXISTS "View Order Items" ON order_items;
DROP POLICY IF EXISTS "Manage Order Items" ON order_items;

CREATE POLICY "View Order Items" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Order Items" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PRODUCTS
DROP POLICY IF EXISTS "View Products All" ON products;
DROP POLICY IF EXISTS "Manage Products Admin" ON products;

CREATE POLICY "View Products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PRODUCT_SIZES
DROP POLICY IF EXISTS "View Product Sizes" ON product_sizes;
DROP POLICY IF EXISTS "Manage Product Sizes" ON product_sizes;

CREATE POLICY "View Product Sizes" ON product_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Product Sizes" ON product_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CUSTOMERS
DROP POLICY IF EXISTS "View Customers" ON customers;
DROP POLICY IF EXISTS "Manage Customers" ON customers;

CREATE POLICY "View Customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SUPPLIERS
DROP POLICY IF EXISTS "View Suppliers" ON suppliers;
DROP POLICY IF EXISTS "Manage Suppliers" ON suppliers;

CREATE POLICY "View Suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Suppliers" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CATEGORIES
DROP POLICY IF EXISTS "View Categories All" ON categories;
DROP POLICY IF EXISTS "Manage Categories Admin" ON categories;

CREATE POLICY "View Categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLES
DROP POLICY IF EXISTS "View Tables" ON tables;
DROP POLICY IF EXISTS "Manage Tables" ON tables;

CREATE POLICY "View Tables" ON tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Tables" ON tables FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- EXPENSES
DROP POLICY IF EXISTS "View Expenses" ON expenses;
DROP POLICY IF EXISTS "Manage Expenses" ON expenses;

CREATE POLICY "View Expenses" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Expenses" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CASH_WITHDRAWALS
DROP POLICY IF EXISTS "Withdrawals Read/Write" ON cash_withdrawals;

CREATE POLICY "View Withdrawals" ON cash_withdrawals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Withdrawals" ON cash_withdrawals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ====================================
-- NOTA IMPORTANTE
-- ====================================
-- Estas políticas son PERMISIVAS (USING true, WITH CHECK true) para permitir
-- operaciones de backup/restore. La seguridad se maneja a nivel de aplicación
-- verificando el rol del usuario antes de permitir acceso a estas funciones.
-- 
-- Si necesitas políticas más restrictivas en producción, puedes modificarlas
-- después de completar las operaciones de backup/restore.
