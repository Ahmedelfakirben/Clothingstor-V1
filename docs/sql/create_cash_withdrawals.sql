-- Tabla para registrar retiros de caja
-- Permite al admin registrar cuando se saca dinero de la caja

CREATE TABLE IF NOT EXISTS cash_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cash_register_sessions(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  withdrawn_by UUID NOT NULL REFERENCES employee_profiles(id),
  withdrawn_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_cash_withdrawals_session ON cash_withdrawals(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_withdrawals_withdrawn_at ON cash_withdrawals(withdrawn_at);

-- Habilitar RLS (Row Level Security)
ALTER TABLE cash_withdrawals ENABLE ROW LEVEL SECURITY;

-- Política: Todos los usuarios autenticados pueden ver retiros
CREATE POLICY "Authenticated users can view withdrawals"
ON cash_withdrawals FOR SELECT
TO authenticated
USING (true);

-- Política: Solo admin y super_admin pueden insertar retiros
CREATE POLICY "Only admins can insert withdrawals"
ON cash_withdrawals FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE employee_profiles.id = auth.uid()
    AND employee_profiles.role IN ('admin', 'super_admin')
  )
);

-- Política: Solo admin y super_admin pueden actualizar retiros
CREATE POLICY "Only admins can update withdrawals"
ON cash_withdrawals FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE employee_profiles.id = auth.uid()
    AND employee_profiles.role IN ('admin', 'super_admin')
  )
);

-- Política: Solo admin y super_admin pueden eliminar retiros
CREATE POLICY "Only admins can delete withdrawals"
ON cash_withdrawals FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE employee_profiles.id = auth.uid()
    AND employee_profiles.role IN ('admin', 'super_admin')
  )
);

-- Habilitar Realtime para actualizaciones en tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE cash_withdrawals;

-- Comentarios para documentación
COMMENT ON TABLE cash_withdrawals IS 'Registra los retiros de dinero de la caja durante el día';
COMMENT ON COLUMN cash_withdrawals.session_id IS 'Sesión de caja a la que pertenece el retiro';
COMMENT ON COLUMN cash_withdrawals.amount IS 'Cantidad de dinero retirado';
COMMENT ON COLUMN cash_withdrawals.reason IS 'Motivo del retiro (ej: Depósito bancario, Pago a proveedor, etc.)';
COMMENT ON COLUMN cash_withdrawals.withdrawn_by IS 'Usuario que registró el retiro';
COMMENT ON COLUMN cash_withdrawals.notes IS 'Notas adicionales opcionales';

-- Verificar que se creó correctamente
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'cash_withdrawals'
ORDER BY ordinal_position;
