-- Add theme column to company_settings table
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'amber';

-- Add check constraint for valid theme values
ALTER TABLE company_settings
ADD CONSTRAINT valid_theme CHECK (theme IN ('amber', 'dark', 'blue', 'green'));

-- Update existing record to have amber theme (default)
UPDATE company_settings
SET theme = 'amber'
WHERE theme IS NULL;
