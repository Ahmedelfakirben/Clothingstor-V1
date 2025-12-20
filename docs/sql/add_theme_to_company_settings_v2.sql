-- Add theme column to company_settings table (SAFE VERSION)
-- This script can be run multiple times without errors

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings'
    AND column_name = 'theme'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN theme VARCHAR(20) DEFAULT 'amber';
    RAISE NOTICE 'Column "theme" added successfully';
  ELSE
    RAISE NOTICE 'Column "theme" already exists, skipping';
  END IF;
END $$;

-- Drop existing constraint if it exists and recreate it
ALTER TABLE company_settings DROP CONSTRAINT IF EXISTS valid_theme;

-- Add check constraint for valid theme values
ALTER TABLE company_settings
ADD CONSTRAINT valid_theme CHECK (theme IN ('amber', 'dark', 'blue', 'green'));

-- Update existing records to have amber theme if NULL
UPDATE company_settings
SET theme = 'amber'
WHERE theme IS NULL;

-- Verify the changes
SELECT id, theme FROM company_settings;
