-- ====================================
-- TEST DELETE DIRECTO (EJECUTAR COMO SUPER ADMIN)
-- ====================================
-- Este script intenta eliminar datos directamente
-- para verificar si las políticas RLS están bloqueando
-- ====================================

-- IMPORTANTE: Ejecuta esto estando logueado como super_admin en Supabase

-- Test 1: Intentar eliminar una orden específica
DELETE FROM orders WHERE id IN (
  SELECT id FROM orders LIMIT 1
);

-- Ver cuántas órdenes quedan
SELECT COUNT(*) as orders_remaining FROM orders;

-- Test 2: Intentar eliminar todo el historial
DELETE FROM order_history WHERE created_at > '1970-01-01';

-- Ver cuánto historial queda
SELECT COUNT(*) as history_remaining FROM order_history;

-- Test 3: Intentar eliminar sesiones de caja
DELETE FROM cash_register_sessions WHERE created_at > '1970-01-01';

-- Ver cuántas sesiones quedan
SELECT COUNT(*) as sessions_remaining FROM cash_register_sessions;

-- Test 4: Intentar eliminar órdenes eliminadas
DELETE FROM deleted_orders WHERE deleted_at > '1970-01-01';

-- Ver cuántas quedan
SELECT COUNT(*) as deleted_orders_remaining FROM deleted_orders;

-- Si estos DELETE funcionan, el problema es que las políticas RLS
-- solo funcionan para operaciones SQL directas pero no para
-- operaciones desde la API de Supabase (supabase-js)
