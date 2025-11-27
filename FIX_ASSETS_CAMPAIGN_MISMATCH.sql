-- Fix: Check if assets belong to wrong campaign or need campaign assignment
-- Run this to diagnose and fix asset-campaign mismatches

-- 1. Check assets that belong to user but might be in wrong campaign
SELECT 
    'Assets with Campaign Mismatch' as check_type,
    a.id as asset_id,
    a.campaign_id,
    a.user_id,
    c.id as campaign_exists,
    c.user_id as campaign_user_id,
    c.name as campaign_name,
    CASE 
        WHEN c.id IS NULL THEN '❌ Campaign does not exist'
        WHEN a.user_id != c.user_id THEN '❌ User mismatch between asset and campaign'
        ELSE '✅ OK'
    END as status
FROM assets a
LEFT JOIN campaigns c ON a.campaign_id = c.id
WHERE a.user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
ORDER BY a.created_at DESC
LIMIT 20;

-- 2. Find the default "My Library" campaign for this user
SELECT 
    'Default Campaign' as check_type,
    id,
    name,
    user_id,
    created_at
FROM campaigns
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
  AND name = 'My Library';

-- 3. Count assets per campaign for this user
SELECT 
    'Asset Distribution' as check_type,
    campaign_id,
    COUNT(*) as asset_count,
    c.name as campaign_name
FROM assets a
LEFT JOIN campaigns c ON a.campaign_id = c.id
WHERE a.user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
GROUP BY campaign_id, c.name
ORDER BY asset_count DESC;

-- 4. OPTION A: Move all assets to default "My Library" campaign
-- Uncomment and run if you want to consolidate all assets into "My Library"
/*
UPDATE assets
SET campaign_id = (
    SELECT id FROM campaigns 
    WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid 
    AND name = 'My Library'
    LIMIT 1
)
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
  AND campaign_id != (
    SELECT id FROM campaigns 
    WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid 
    AND name = 'My Library'
    LIMIT 1
  );
*/

-- 5. OPTION B: Show all user's assets regardless of campaign
-- This would require code changes to load all assets, not just from one campaign


