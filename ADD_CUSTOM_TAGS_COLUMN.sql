-- Add custom_tags column to tag_config table if it doesn't exist

-- Check if column exists first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tag_config' 
        AND column_name = 'custom_tags'
    ) THEN
        ALTER TABLE tag_config ADD COLUMN custom_tags text[] DEFAULT '{}'::text[];
        RAISE NOTICE 'Added custom_tags column to tag_config';
    ELSE
        RAISE NOTICE 'custom_tags column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tag_config'
  AND column_name = 'custom_tags';


