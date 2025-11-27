-- Check tag_config table schema

-- 1. Check what columns exist
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tag_config'
ORDER BY ordinal_position;

-- 2. Check current data structure
SELECT 
    user_id,
    auto_tags,
    custom_tags,
    deleted_tags
FROM tag_config
LIMIT 1;


