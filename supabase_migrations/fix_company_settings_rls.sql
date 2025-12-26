-- Enable RLS on company_settings if not already enabled
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- 1. Policy for Reading: Allow ALL authenticated users to read the company settings
-- This is crucial so that basic users (like the second admin) can see the language/theme
DROP POLICY IF EXISTS "Allow authenticated users to read company settings" ON company_settings;

CREATE POLICY "Allow authenticated users to read company settings"
ON company_settings
FOR SELECT
TO authenticated
USING (true);

-- 2. Policy for Modifying: Allow ONLY admin and super_admin to modify settings
DROP POLICY IF EXISTS "Allow admins to modify company settings" ON company_settings;

CREATE POLICY "Allow admins to modify company settings"
ON company_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employee_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);
