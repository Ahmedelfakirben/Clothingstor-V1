-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy for reading (selecting) customers - All authenticated users can read
CREATE POLICY "View Customers All" ON customers 
FOR SELECT 
TO authenticated 
USING (true);

-- Policy for modifying customers - Only Admins and Cashiers
CREATE POLICY "Manage Customers" ON customers 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM employee_profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'cashier')
  )
);
