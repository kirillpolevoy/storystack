-- Debug: Why photos aren't showing for user 9b934e32-28c0-43fe-a105-60d4230e7096

-- 1. Check if user has campaigns
SELECT 
    'User Campaigns' as check_type,
    id,
    name,
    user_id,
    created_at
FROM campaigns
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
ORDER BY created_at;

-- 2. Check assets for this user
SELECT 
    'User Assets' as check_type,
    id,
    campaign_id,
    user_id,
    storage_path,
    created_at
FROM assets
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if assets have matching campaign_id
SELECT 
    'Asset-Campaign Match' as check_type,
    a.id as asset_id,
    a.campaign_id,
    a.user_id as asset_user_id,
    c.id as campaign_exists,
    c.user_id as campaign_user_id,
    CASE 
        WHEN c.id IS NULL THEN '❌ Campaign not found'
        WHEN a.user_id != c.user_id THEN '❌ User mismatch'
        ELSE '✅ Match'
    END as status
FROM assets a
LEFT JOIN campaigns c ON a.campaign_id = c.id
WHERE a.user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
LIMIT 10;

-- 4. Count assets by campaign
SELECT 
    'Assets by Campaign' as check_type,
    campaign_id,
    COUNT(*) as asset_count,
    MIN(created_at) as first_asset,
    MAX(created_at) as last_asset
FROM assets
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
GROUP BY campaign_id
ORDER BY asset_count DESC;

-- 5. Check for assets with NULL user_id (shouldn't exist)
SELECT 
    'NULL user_id Assets' as check_type,
    COUNT(*) as count
FROM assets
WHERE user_id IS NULL;

-- 6. Check default campaign for this user
SELECT 
    'Default Campaign Check' as check_type,
    id,
    name,
    user_id
FROM campaigns
WHERE user_id = '9b934e32-28c0-43fe-a105-60d4230e7096'::uuid
  AND name = 'My Library';


