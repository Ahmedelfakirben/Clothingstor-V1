-- ==========================================================
-- SOLUCIÓN: PERMITIR A ADMINISTRADORES MODIFICAR USUARIOS
-- ==========================================================
-- Este script agrega la política de Row Level Security (RLS) necesaria 
-- en la tabla "employee_profiles" para que los roles "admin" y "super_admin" 
-- puedan actualizar perfiles de otros empleados (por ejemplo, para 
-- desactivarlos, eliminarlos lógicamente o modificar correos).

CREATE POLICY "Admin Update Profiles" ON public.employee_profiles 
FOR UPDATE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM employee_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
