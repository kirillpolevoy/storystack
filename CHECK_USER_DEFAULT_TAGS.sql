-- Check why user kpolevoy+123@gmail.com still sees default tags

-- 1. Find the user_id
SELECT 
    'User Info' as check_type,
    id as user_id,
    email
FROM auth.users
WHERE email = 'kpolevoy+123@gmail.com';

-- 2. Check what tags are in their assets (these will show up in Tag Management)
SELECT 
    'Tags from Assets' as check_type,
    unnest(tags) as tag_name,
    COUNT(*) as usage_count
FROM assets
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)
AND tags IS NOT NULL
AND array_length(tags, 1) > 0
GROUP BY tag_name
ORDER BY tag_name;

-- 3. Check custom_tags in tag_config
SELECT 
    'Custom Tags' as check_type,
    unnest(custom_tags) as tag_name
FROM tag_config
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)
AND custom_tags IS NOT NULL
AND array_length(custom_tags, 1) > 0;

-- 4. Check auto_tags in tag_config
SELECT 
    'Auto Tags' as check_type,
    unnest(auto_tags) as tag_name
FROM tag_config
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)
AND auto_tags IS NOT NULL
AND array_length(auto_tags, 1) > 0;

-- 5. List all default tags that might be present
WITH default_tags AS (
    SELECT unnest(ARRAY[
        'Product', 'Lifestyle', 'Studio', 'Bright', 'Moody', 
        'Onyx', 'Layered Look', 'Semi-Precious Stone', 
        'Choker Statement', 'Everyday Luxe', 'Necklace Stack'
    ]) as default_tag
),
user_tags AS (
    SELECT DISTINCT unnest(tags) as tag_name
    FROM assets
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com')
    AND tags IS NOT NULL
    UNION
    SELECT unnest(custom_tags) as tag_name
    FROM tag_config
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com')
    AND custom_tags IS NOT NULL
)
SELECT 
    'Default Tags Found' as check_type,
    dt.default_tag,
    CASE WHEN ut.tag_name IS NOT NULL THEN '✅ Found in user data' ELSE '❌ Not found' END as status
FROM default_tags dt
LEFT JOIN user_tags ut ON dt.default_tag = ut.tag_name
ORDER BY dt.default_tag;


