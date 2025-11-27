-- Verify tags are actually saved to database
-- Run this to check if Tag Management is saving correctly

-- Check what's in the database
SELECT 
    'Database Check' as check_type,
    user_id,
    auto_tags,
    array_length(auto_tags, 1) as enabled_count,
    auto_tags::text as tags_list,
    CASE 
        WHEN auto_tags IS NULL THEN '❌ NULL - No config'
        WHEN array_length(auto_tags, 1) IS NULL THEN '⚠️ EMPTY ARRAY - No tags enabled'
        WHEN array_length(auto_tags, 1) = 0 THEN '⚠️ EMPTY ARRAY - No tags enabled'
        ELSE '✅ HAS ' || array_length(auto_tags, 1)::text || ' ENABLED TAGS'
    END as status
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;

-- List each enabled tag
SELECT 
    'Enabled Tags List' as check_type,
    unnest(auto_tags) as tag_name
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
  AND auto_tags IS NOT NULL
  AND array_length(auto_tags, 1) > 0;

