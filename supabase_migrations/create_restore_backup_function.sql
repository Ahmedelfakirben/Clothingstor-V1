-- ====================================
-- FUNCIÓN PARA RESTORE DESDE LA APLICACIÓN
-- ====================================
-- Esta función permite restaurar backups desde la app
-- Usa SECURITY DEFINER para bypassear RLS
-- ====================================

CREATE OR REPLACE FUNCTION public.restore_backup_from_app(backup_data jsonb)
RETURNS json AS $$
DECLARE
  table_name text;
  records jsonb;
  inserted_count integer := 0;
  total_inserted integer := 0;
  failed_tables text[] := '{}';
BEGIN
  -- Verificar que el usuario actual sea super_admin
  IF NOT EXISTS (
    SELECT 1 FROM employee_profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Solo el Super Administrador puede restaurar backups'
    );
  END IF;

  -- Orden de restauración (respetando dependencias)
  FOR table_name IN 
    SELECT unnest(ARRAY[
      'company_settings',
      'app_currency_settings',
      'backup_config',
      'role_permissions',
      'tables',
      'available_currencies',
      'categories',
      'suppliers',
      'employee_profiles',
      'customers',
      'products',
      'product_sizes',
      'cash_register_sessions',
      'cash_withdrawals',
      'orders',
      'order_items',
      'order_history',
      'deleted_products',
      'deleted_orders',
      'backup_history',
      'expenses'
    ])
  LOOP
    -- Verificar si la tabla existe en el backup
    IF backup_data->'tables' ? table_name THEN
      records := backup_data->'tables'->table_name;
      
      -- Insertar registros usando EXECUTE para evitar problemas de RLS
      BEGIN
        -- Usar ON CONFLICT DO NOTHING para evitar errores de duplicados
        EXECUTE format(
          'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(NULL::%I, $1) ON CONFLICT (id) DO NOTHING',
          table_name, table_name
        ) USING records;
        
        GET DIAGNOSTICS inserted_count = ROW_COUNT;
        total_inserted := total_inserted + inserted_count;
        
      EXCEPTION WHEN OTHERS THEN
        -- Si falla (ej. tabla sin columna id), intentar sin ON CONFLICT
        BEGIN
          EXECUTE format(
            'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(NULL::%I, $1)',
            table_name, table_name
          ) USING records;
          
          GET DIAGNOSTICS inserted_count = ROW_COUNT;
          total_inserted := total_inserted + inserted_count;
          
        EXCEPTION WHEN OTHERS THEN
          -- Solo registrar el error si no es un error de clave duplicada o FK
          IF SQLSTATE NOT IN ('23505', '23503') THEN
            failed_tables := array_append(failed_tables, table_name || ': ' || SQLERRM);
          END IF;
        END;
      END;
    END IF;
  END LOOP;

  -- Retornar resultado
  RETURN json_build_object(
    'success', true,
    'total_inserted', total_inserted,
    'failed_tables', failed_tables,
    'message', 'Restauración completada'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION public.restore_backup_from_app(jsonb) TO authenticated;

-- Comentario
COMMENT ON FUNCTION public.restore_backup_from_app(jsonb) IS 
'Restaura un backup desde la aplicación. Solo puede ser ejecutada por super_admin. Usa SECURITY DEFINER para bypassear RLS.';
