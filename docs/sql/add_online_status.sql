-- Migration: Add online status tracking to employee_profiles
-- Purpose: Track real-time connection status of employees

-- Add online status columns
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_logout TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the columns
COMMENT ON COLUMN employee_profiles.is_online IS 'Current connection status: true = online/available, false = offline/unavailable';
COMMENT ON COLUMN employee_profiles.last_login IS 'Timestamp of last login';
COMMENT ON COLUMN employee_profiles.last_logout IS 'Timestamp of last logout or manual disconnect';

-- Create index for faster queries on online status
CREATE INDEX IF NOT EXISTS idx_employee_profiles_is_online ON employee_profiles(is_online) WHERE is_online = true;

-- Enable Realtime for the table (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE employee_profiles;

-- Ensure REPLICA IDENTITY is set for Realtime
ALTER TABLE employee_profiles REPLICA IDENTITY FULL;

-- Verify the changes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'employee_profiles'
AND column_name IN ('is_online', 'last_login', 'last_logout');
