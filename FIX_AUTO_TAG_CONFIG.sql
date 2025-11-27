-- Fix: Enable auto-tagging for user 9b934e32-28c0-43fe-a105-60d4230e7096
-- This will enable some default tags for auto-tagging

-- Option 1: Update existing tag_config to enable some tags
UPDATE tag_config
SET auto_tags = '["Product", "Lifestyle", "Studio", "Bright", "Moody", "Necklace", "Earrings", "Rings", "Bracelets"]'::jsonb
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;

-- Option 2: If tag_config doesn't exist, create it
INSERT INTO tag_config (user_id, auto_tags, custom_tags, deleted_tags)
VALUES (
    '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid,
    '["Product", "Lifestyle", "Studio", "Bright", "Moody", "Necklace", "Earrings", "Rings", "Bracelets"]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
)
ON CONFLICT (user_id) DO UPDATE
SET auto_tags = EXCLUDED.auto_tags;

-- Verify the update
SELECT 
    user_id,
    auto_tags,
    jsonb_array_length(auto_tags) as tag_count
FROM tag_config
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;


