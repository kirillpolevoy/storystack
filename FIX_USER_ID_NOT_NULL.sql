-- Fix: Make user_id NOT NULL on all tables
-- Run this to fix the FAIL status

-- First, verify there are no NULL values (should already be true based on your check)
SELECT 
    'campaigns' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_count
FROM campaigns
UNION ALL
SELECT 
    'assets' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_count
FROM assets
UNION ALL
SELECT 
    'tag_config' as table_name,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_count
FROM tag_config;

-- If all null_count are 0, proceed with making columns NOT NULL
ALTER TABLE campaigns ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE assets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tag_config ALTER COLUMN user_id SET NOT NULL;

-- Verify the change
SELECT 
    table_name,
    column_name,
    is_nullable,
    CASE 
        WHEN is_nullable = 'NO' THEN '✅ NOT NULL'
        ELSE '❌ STILL NULLABLE'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('campaigns', 'assets', 'tag_config')
  AND column_name = 'user_id'
ORDER BY table_name;


