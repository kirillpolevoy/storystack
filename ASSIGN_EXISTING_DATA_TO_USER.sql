-- Assign all existing data to user: 9b934e32-28c0-43fe-a105-60d4230e7096
-- Run these BEFORE completing the migration

-- 1. Update tag_config to assign to user
UPDATE tag_config 
SET user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid 
WHERE user_id IS NULL;

-- 2. Update campaigns to assign to user (if any exist without user_id)
UPDATE campaigns 
SET user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid 
WHERE user_id IS NULL;

-- 3. Update assets to assign to user (if any exist without user_id)
-- This assigns assets to the user based on their campaign's user_id
UPDATE assets 
SET user_id = (
  SELECT user_id 
  FROM campaigns 
  WHERE campaigns.id = assets.campaign_id
)
WHERE user_id IS NULL;

-- If assets don't have a campaign_id, assign directly:
UPDATE assets 
SET user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid 
WHERE user_id IS NULL AND campaign_id IS NULL;

-- Verify the updates
SELECT 'tag_config' as table_name, COUNT(*) as rows_assigned FROM tag_config WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
UNION ALL
SELECT 'assets', COUNT(*) FROM assets WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid;


