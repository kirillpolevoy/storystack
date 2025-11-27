-- Enable auto-tagging for user 9b934e32-28c0-43fe-a105-60d4230e7096
-- This will enable default tags so auto-tagging works

-- Check current status
SELECT 
    'Current Status' as check_type,
    user_id,
    auto_tags,
    jsonb_array_length(COALESCE(auto_tags, '[]'::jsonb)) as enabled_tag_count
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;

-- Enable default tags for auto-tagging
UPDATE tag_config
SET auto_tags = '["Product", "Lifestyle", "Studio", "Bright", "Moody", "Necklace", "Earrings", "Rings", "Bracelets"]'::jsonb
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;

-- If tag_config doesn't exist, create it
INSERT INTO tag_config (user_id, auto_tags, custom_tags, deleted_tags)
SELECT 
    '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid,
    '["Product", "Lifestyle", "Studio", "Bright", "Moody", "Necklace", "Earrings", "Rings", "Bracelets"]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM tag_config 
    WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
);

-- Verify
SELECT 
    'After Update' as check_type,
    user_id,
    auto_tags,
    jsonb_array_length(auto_tags) as enabled_tag_count
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;


