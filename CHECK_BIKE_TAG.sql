-- Check if "Bike" was passed in auto_tags for user kpolevoy+123@gmail.com

-- 1. Find the user_id
SELECT 
    'User Info' as check_type,
    id as user_id,
    email
FROM auth.users
WHERE email = 'kpolevoy+123@gmail.com';

-- 2. Check auto_tags in tag_config
SELECT 
    'Auto Tags Config' as check_type,
    user_id,
    auto_tags,
    array_length(auto_tags, 1) as enabled_count,
    CASE 
        WHEN 'Bike' = ANY(auto_tags) THEN '✅ "Bike" IS in auto_tags'
        ELSE '❌ "Bike" is NOT in auto_tags'
    END as bike_status
FROM tag_config
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
);

-- 3. List all enabled auto_tags
SELECT 
    'Enabled Auto-Tags' as check_type,
    unnest(auto_tags) as tag_name
FROM tag_config
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)
AND auto_tags IS NOT NULL
AND array_length(auto_tags, 1) > 0
ORDER BY tag_name;

-- 4. Check if "Bike" appears on any photos
SELECT 
    'Photos with Bike Tag' as check_type,
    id as asset_id,
    tags,
    created_at
FROM assets
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)
AND 'Bike' = ANY(tags)
ORDER BY created_at DESC;

-- 5. Check all tags on all photos for this user
SELECT 
    'All Photo Tags' as check_type,
    id as asset_id,
    tags,
    array_length(tags, 1) as tag_count,
    created_at
FROM assets
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)
ORDER BY created_at DESC;


