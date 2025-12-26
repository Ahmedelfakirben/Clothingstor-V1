-- ====================================
-- FUNCIÓN PARA RESET DESDE LA APLICACIÓN
-- ====================================
-- Esta función permite resetear la base de datos desde la app
-- Usa SECURITY DEFINER para bypassear RLS (única forma que funciona)
-- ====================================

CREATE OR REPLACE FUNCTION public.reset_database_from_app()
RETURNS json AS $$
DECLARE
  result_data json;
BEGIN
  -- Verificar que el usuario actual sea super_admin
  IF NOT EXISTS (
    SELECT 1 FROM employee_profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Solo el Super Administrador puede resetear la base de datos'
    );
  END IF;

  -- Eliminar datos en orden de dependencias
  DELETE FROM order_items WHERE true;
  DELETE FROM order_history WHERE true;
  DELETE FROM cash_withdrawals WHERE true;
  DELETE FROM orders WHERE true;
  DELETE FROM product_sizes WHERE true;
  DELETE FROM cash_register_sessions WHERE true;
  DELETE FROM products WHERE true;
  DELETE FROM expenses WHERE true;
  DELETE FROM customers WHERE true;
  DELETE FROM suppliers WHERE true;
  DELETE FROM categories WHERE true;
  DELETE FROM tables WHERE true;
  DELETE FROM deleted_products WHERE true;
  DELETE FROM deleted_orders WHERE true;
  DELETE FROM backup_history WHERE true;
  
  -- Eliminar empleados NO administradores
  DELETE FROM employee_profiles 
  WHERE role NOT IN ('super_admin', 'admin');

  -- Retornar éxito
  result_data := json_build_object(
    'success', true,
    'message', 'Base de datos reseteada correctamente',
    'orders_remaining', (SELECT COUNT(*) FROM orders),
    'products_remaining', (SELECT COUNT(*) FROM products),
    'employees_remaining', (SELECT COUNT(*) FROM employee_profiles)
  );

  RETURN result_data;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.reset_database_from_app() TO authenticated;

-- Comentario
COMMENT ON FUNCTION public.reset_database_from_app() IS 
'Resetea la base de datos eliminando todos los datos excepto usuarios admin/super_admin y configuraciones. Solo puede ser ejecutada por super_admin. Usa SECURITY DEFINER para bypassear RLS.';
