-- Remove default tags from user kpolevoy+123@gmail.com
-- This will:
-- 1. Remove default tags from auto_tags
-- 2. Remove default tags from custom_tags  
-- 3. Add default tags to deleted_tags (so they don't reappear)

-- Default tags to remove
WITH default_tags AS (
    SELECT unnest(ARRAY[
        'Product', 'Lifestyle', 'Studio', 'Bright', 'Moody', 
        'Onyx', 'Layered Look', 'Semi-Precious Stone', 
        'Choker Statement', 'Everyday Luxe', 'Necklace Stack'
    ]) as tag
),
user_id_lookup AS (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)

-- Update tag_config: remove defaults from auto_tags and custom_tags, add to deleted_tags
UPDATE tag_config
SET 
    -- Remove default tags from auto_tags
    auto_tags = (
        SELECT array_agg(tag)
        FROM unnest(auto_tags) as tag
        WHERE tag NOT IN (SELECT tag FROM default_tags)
    ),
    -- Remove default tags from custom_tags
    custom_tags = (
        SELECT array_agg(tag)
        FROM unnest(COALESCE(custom_tags, ARRAY[]::text[])) as tag
        WHERE tag NOT IN (SELECT tag FROM default_tags)
    ),
    -- Add default tags to deleted_tags (if not already there)
    deleted_tags = (
        SELECT array_agg(DISTINCT tag)
        FROM (
            SELECT unnest(COALESCE(deleted_tags, ARRAY[]::text[])) as tag
            UNION
            SELECT tag FROM default_tags
        ) combined
    )
WHERE user_id = (SELECT id FROM user_id_lookup);

-- Verify the update
SELECT 
    'After Cleanup' as check_type,
    user_id,
    auto_tags,
    array_length(auto_tags, 1) as auto_count,
    custom_tags,
    array_length(custom_tags, 1) as custom_count,
    deleted_tags,
    array_length(deleted_tags, 1) as deleted_count
FROM tag_config
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com');


