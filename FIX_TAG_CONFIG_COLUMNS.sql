-- Fix tag_config table: Add missing columns (custom_tags, deleted_tags)

-- Add custom_tags column if it doesn't exist
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
        RAISE NOTICE '✅ Added custom_tags column to tag_config';
    ELSE
        RAISE NOTICE 'ℹ️  custom_tags column already exists';
    END IF;
END $$;

-- Add deleted_tags column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tag_config' 
        AND column_name = 'deleted_tags'
    ) THEN
        ALTER TABLE tag_config ADD COLUMN deleted_tags text[] DEFAULT '{}'::text[];
        RAISE NOTICE '✅ Added deleted_tags column to tag_config';
    ELSE
        RAISE NOTICE 'ℹ️  deleted_tags column already exists';
    END IF;
END $$;

-- Verify all columns exist
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tag_config'
ORDER BY ordinal_position;

-- Update existing rows to have empty arrays if they're NULL
UPDATE tag_config
SET 
    custom_tags = COALESCE(custom_tags, '{}'::text[]),
    deleted_tags = COALESCE(deleted_tags, '{}'::text[])
WHERE custom_tags IS NULL OR deleted_tags IS NULL;


