-- Check auto-tagging configuration for user 9b934e32-28c0-43fe-a105-60d4230e7096

-- 1. Check if tag_config exists for this user
SELECT 
    'tag_config check' as check_type,
    user_id,
    auto_tags,
    custom_tags,
    deleted_tags,
    created_at,
    updated_at
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;

-- 2. Check if auto_tags is empty or null
SELECT 
    'auto_tags status' as check_type,
    CASE 
        WHEN auto_tags IS NULL THEN '❌ NULL'
        WHEN jsonb_array_length(auto_tags) = 0 THEN '❌ EMPTY ARRAY'
        ELSE '✅ HAS TAGS: ' || jsonb_array_length(auto_tags)::text || ' tags'
    END as status,
    auto_tags
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;

-- 3. Check recent assets to see if they have tags
SELECT 
    'Recent Assets' as check_type,
    id,
    storage_path,
    tags,
    created_at
FROM assets
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
ORDER BY created_at DESC
LIMIT 10;


