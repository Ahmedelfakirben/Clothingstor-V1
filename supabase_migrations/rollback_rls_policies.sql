-- ====================================
-- ROLLBACK: REVERTIR POLÍTICAS PROBLEMÁTICAS
-- ====================================
-- Ejecuta esto PRIMERO para revertir las políticas que causan recursión infinita
-- ====================================

-- Eliminar políticas problemáticas de employee_profiles
DROP POLICY IF EXISTS "Super Admin Manage Profiles" ON employee_profiles;
DROP POLICY IF EXISTS "System Operations" ON employee_profiles;
DROP POLICY IF EXISTS "Update Self" ON employee_profiles;
DROP POLICY IF EXISTS "View Profiles" ON employee_profiles;

-- Restaurar políticas originales de employee_profiles
CREATE POLICY "View Profiles" 
ON employee_profiles 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Update Self" 
ON employee_profiles 
FOR UPDATE 
TO authenticated 
USING (id = auth.uid());

-- Eliminar políticas de configuración
DROP POLICY IF EXISTS "Super Admin Manage Currency Settings" ON app_currency_settings;
DROP POLICY IF EXISTS "View Currency Settings" ON app_currency_settings;
DROP POLICY IF EXISTS "Manage Currency Settings" ON app_currency_settings;

DROP POLICY IF EXISTS "Super Admin Manage Sessions" ON cash_register_sessions;
DROP POLICY IF EXISTS "View Sessions" ON cash_register_sessions;
DROP POLICY IF EXISTS "Manage Sessions" ON cash_register_sessions;

DROP POLICY IF EXISTS "Super Admin Manage Order History" ON order_history;
DROP POLICY IF EXISTS "View Order History" ON order_history;
DROP POLICY IF EXISTS "Manage Order History" ON order_history;

DROP POLICY IF EXISTS "Super Admin Manage Backup History" ON backup_history;
DROP POLICY IF EXISTS "View Backup History" ON backup_history;
DROP POLICY IF EXISTS "Manage Backup History" ON backup_history;

DROP POLICY IF EXISTS "Super Admin Manage Backup Config" ON backup_config;
DROP POLICY IF EXISTS "View Backup Config" ON backup_config;
DROP POLICY IF EXISTS "Manage Backup Config" ON backup_config;

DROP POLICY IF EXISTS "Super Admin Manage Company Settings" ON company_settings;
DROP POLICY IF EXISTS "View Company Settings" ON company_settings;
DROP POLICY IF EXISTS "Manage Company Settings" ON company_settings;

DROP POLICY IF EXISTS "Super Admin Manage Permissions" ON role_permissions;
DROP POLICY IF EXISTS "View Permissions" ON role_permissions;
DROP POLICY IF EXISTS "Manage Permissions" ON role_permissions;

DROP POLICY IF EXISTS "Admin View Deleted Products" ON deleted_products;
DROP POLICY IF EXISTS "Super Admin Manage Deleted Products" ON deleted_products;
DROP POLICY IF EXISTS "View Deleted Products" ON deleted_products;
DROP POLICY IF EXISTS "Manage Deleted Products" ON deleted_products;

DROP POLICY IF EXISTS "Admin View Deleted Orders" ON deleted_orders;
DROP POLICY IF EXISTS "Super Admin Manage Deleted Orders" ON deleted_orders;
DROP POLICY IF EXISTS "View Deleted Orders" ON deleted_orders;
DROP POLICY IF EXISTS "Manage Deleted Orders" ON deleted_orders;

DROP POLICY IF EXISTS "Everyone View Currencies" ON available_currencies;
DROP POLICY IF EXISTS "Super Admin Manage Currencies" ON available_currencies;
DROP POLICY IF EXISTS "View Currencies" ON available_currencies;
DROP POLICY IF EXISTS "Manage Currencies" ON available_currencies;

-- Eliminar políticas de tablas de datos
DROP POLICY IF EXISTS "View Orders" ON orders;
DROP POLICY IF EXISTS "Manage Orders" ON orders;

DROP POLICY IF EXISTS "View Order Items" ON order_items;
DROP POLICY IF EXISTS "Manage Order Items" ON order_items;

DROP POLICY IF EXISTS "View Products" ON products;
DROP POLICY IF EXISTS "Manage Products" ON products;

DROP POLICY IF EXISTS "View Product Sizes" ON product_sizes;
DROP POLICY IF EXISTS "Manage Product Sizes" ON product_sizes;

DROP POLICY IF EXISTS "View Customers" ON customers;
DROP POLICY IF EXISTS "Manage Customers" ON customers;

DROP POLICY IF EXISTS "View Suppliers" ON suppliers;
DROP POLICY IF EXISTS "Manage Suppliers" ON suppliers;

DROP POLICY IF EXISTS "View Categories" ON categories;
DROP POLICY IF EXISTS "Manage Categories" ON categories;

DROP POLICY IF EXISTS "View Tables" ON tables;
DROP POLICY IF EXISTS "Manage Tables" ON tables;

DROP POLICY IF EXISTS "View Expenses" ON expenses;
DROP POLICY IF EXISTS "Manage Expenses" ON expenses;

DROP POLICY IF EXISTS "View Withdrawals" ON cash_withdrawals;
DROP POLICY IF EXISTS "Manage Withdrawals" ON cash_withdrawals;

-- Restaurar políticas originales básicas
CREATE POLICY "View Products All" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Products Admin" ON products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "View Categories All" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage Categories Admin" ON categories FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Employees View Orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees Create Orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Employees Update Orders" ON orders FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Withdrawals Read/Write" ON cash_withdrawals FOR ALL TO authenticated USING (true) WITH CHECK (true);
