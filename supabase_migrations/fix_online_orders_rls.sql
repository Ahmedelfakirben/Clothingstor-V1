-- Allow authenticated users (Admins/Super Admins) to view all online orders
-- This fixes the issue where admins couldn't see customer history for specific users
DROP POLICY IF EXISTS "Allow Admins to View All Online Orders" ON online_orders;

CREATE POLICY "Allow Admins to View All Online Orders"
ON online_orders
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to view all order items
-- Limit this if needed, but for the POS dashboard, admins need to see items for any order
DROP POLICY IF EXISTS "Allow Admins to View All Order Items" ON order_items_online;

CREATE POLICY "Allow Admins to View All Order Items"
ON order_items_online
FOR SELECT
TO authenticated
USING (true);

-- Ensure update capability for admins on online_orders
DROP POLICY IF EXISTS "Allow Admins to Update Online Orders" ON online_orders;

CREATE POLICY "Allow Admins to Update Online Orders"
ON online_orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
