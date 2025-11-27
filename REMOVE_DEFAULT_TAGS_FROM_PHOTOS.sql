-- Remove default tags from photos for user kpolevoy+123@gmail.com
-- WARNING: This will remove default tags from all photos!
-- Only run this if you want to remove these tags from photos

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

-- Update assets: remove default tags from photos
UPDATE assets
SET tags = (
    SELECT array_agg(tag)
    FROM unnest(tags) as tag
    WHERE tag NOT IN (SELECT tag FROM default_tags)
)
WHERE user_id = (SELECT id FROM user_id_lookup)
AND tags IS NOT NULL
AND array_length(tags, 1) > 0
AND EXISTS (
    -- Only update if the photo has at least one default tag
    SELECT 1 
    FROM unnest(tags) as tag
    WHERE tag IN (SELECT tag FROM default_tags)
);

-- Show how many photos were affected
SELECT 
    'Photos Updated' as check_type,
    COUNT(*) as photos_with_default_tags_before,
    COUNT(*) FILTER (WHERE array_length(tags, 1) = 0) as photos_now_empty
FROM assets
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kpolevoy+123@gmail.com');


