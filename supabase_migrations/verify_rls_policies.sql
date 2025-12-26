-- ====================================
-- VERIFICAR POLÍTICAS RLS
-- ====================================
-- Este script verifica qué políticas RLS existen actualmente
-- para las tablas críticas del reset database
-- ====================================

-- Ver todas las políticas de las tablas importantes
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
WHERE tablename IN (
    'orders',
    'order_items',
    'order_history',
    'products',
    'product_sizes',
    'customers',
    'suppliers',
    'categories',
    'tables',
    'expenses',
    'cash_register_sessions',
    'cash_withdrawals',
    'employee_profiles',
    'deleted_products',
    'deleted_orders',
    'backup_history'
)
ORDER BY tablename, policyname;

-- Verificar si RLS está habilitado en las tablas
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN (
    'orders',
    'order_items',
    'order_history',
    'products',
    'product_sizes',
    'customers',
    'suppliers',
    'categories',
    'tables',
    'expenses',
    'cash_register_sessions',
    'cash_withdrawals',
    'employee_profiles',
    'deleted_products',
    'deleted_orders',
    'backup_history'
)
ORDER BY tablename;
