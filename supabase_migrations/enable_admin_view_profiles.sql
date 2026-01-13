-- Enable RLS on customer_profiles if not already active
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (Admins, etc) to view all profiles
-- This is needed for the "Online Store Management" -> "Users" tab
DROP POLICY IF EXISTS "Allow Admins to View All Profiles" ON customer_profiles;

CREATE POLICY "Allow Admins to View All Profiles"
ON customer_profiles
FOR SELECT
TO authenticated
USING (true);

-- Ensure users can Update their own profile (re-applying just in case)
DROP POLICY IF EXISTS "Users can update own profile" ON customer_profiles;

CREATE POLICY "Users can update own profile"
ON customer_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Ensure users can View their own profile (re-applying just in case)
DROP POLICY IF EXISTS "Users can view own profile" ON customer_profiles;

CREATE POLICY "Users can view own profile"
ON customer_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
