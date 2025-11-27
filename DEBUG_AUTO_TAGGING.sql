-- Debug: Check why auto-tagging isn't working
-- Even though tags are enabled in UI

-- 1. Verify tag_config has the enabled tags
SELECT 
    'tag_config check' as check_type,
    user_id,
    auto_tags,
    array_length(auto_tags, 1) as enabled_count,
    auto_tags::text as auto_tags_text,
    CASE 
        WHEN auto_tags IS NULL THEN '❌ NULL - No config'
        WHEN array_length(auto_tags, 1) IS NULL THEN '⚠️ EMPTY - No tags enabled'
        WHEN array_length(auto_tags, 1) = 0 THEN '⚠️ EMPTY - No tags enabled'
        ELSE '✅ HAS ' || array_length(auto_tags, 1)::text || ' ENABLED TAGS'
    END as status
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;

-- 2. Check if edge function URL is configured (check your .env file)
-- EXPO_PUBLIC_EDGE_BASE_URL should be set to your Supabase edge functions URL
-- Format: https://your-project.supabase.co/functions/v1

-- 3. Check recent assets to see if auto-tagging was attempted
SELECT 
    'Recent Assets' as check_type,
    id,
    tags,
    array_length(tags, 1) as tag_count,
    created_at,
    CASE 
        WHEN array_length(tags, 1) = 0 THEN '❌ No tags (auto-tagging may have failed)'
        WHEN array_length(tags, 1) > 0 THEN '✅ Has tags'
        ELSE '⚠️ Tags is null'
    END as status
FROM assets
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
ORDER BY created_at DESC
LIMIT 10;

