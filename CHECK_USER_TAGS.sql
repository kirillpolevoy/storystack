-- Check tags for user kpolevoy+123@gmail.com

-- First, find the user_id for this email
SELECT 
    'User Info' as check_type,
    id as user_id,
    email,
    created_at
FROM auth.users
WHERE email = 'kpolevoy+123@gmail.com';

-- Then check their tag_config
SELECT 
    'Tag Config' as check_type,
    user_id,
    auto_tags,
    array_length(auto_tags, 1) as enabled_count,
    custom_tags,
    array_length(custom_tags, 1) as custom_count,
    deleted_tags,
    array_length(deleted_tags, 1) as deleted_count
FROM tag_config
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
);

-- List enabled auto-tags
SELECT 
    'Enabled Auto-Tags' as check_type,
    unnest(auto_tags) as tag_name
FROM tag_config
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)
AND auto_tags IS NOT NULL
AND array_length(auto_tags, 1) > 0;

-- List custom tags
SELECT 
    'Custom Tags' as check_type,
    unnest(custom_tags) as tag_name
FROM tag_config
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com'
)
AND custom_tags IS NOT NULL
AND array_length(custom_tags, 1) > 0;


