-- Check why auto-tagging isn't working for user 9b934e32-28c0-43fe-a105-60d4230e7096

-- 1. Check if tag_config exists and what auto_tags are enabled
SELECT 
    'tag_config status' as check_type,
    user_id,
    auto_tags,
    array_length(auto_tags, 1) as enabled_tag_count,
    CASE 
        WHEN auto_tags IS NULL THEN '❌ NULL - No config'
        WHEN array_length(auto_tags, 1) IS NULL THEN '⚠️ EMPTY - No tags enabled (go to Tag Management to enable)'
        WHEN array_length(auto_tags, 1) = 0 THEN '⚠️ EMPTY - No tags enabled (go to Tag Management to enable)'
        ELSE '✅ HAS ' || array_length(auto_tags, 1)::text || ' ENABLED TAGS'
    END as status
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;

-- 2. Show which tags are currently enabled
SELECT 
    'Enabled Tags' as check_type,
    unnest(auto_tags) as tag_name
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
  AND auto_tags IS NOT NULL
  AND array_length(auto_tags, 1) > 0;

-- 3. Check recent assets to see if they were auto-tagged
SELECT 
    'Recent Assets' as check_type,
    id,
    tags,
    array_length(tags, 1) as tag_count,
    created_at
FROM assets
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
ORDER BY created_at DESC
LIMIT 10;

