-- Quick test to verify autotagging setup
-- Run this in Supabase SQL Editor

-- 1. Get your workspace ID (replace email with your email)
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  u.email as owner_email
FROM workspaces w
JOIN auth.users u ON u.id = w.created_by
WHERE u.email = 'kpolevoy@gmail.com'  -- Replace with your email
ORDER BY w.created_at DESC
LIMIT 1;

-- 2. Check tag_config for that workspace (replace WORKSPACE_ID)
SELECT 
  workspace_id,
  auto_tags,
  array_length(auto_tags, 1) as tag_count,
  CASE 
    WHEN auto_tags IS NULL THEN 'NULL - No config'
    WHEN array_length(auto_tags, 1) IS NULL THEN 'Empty array - No tags enabled'
    WHEN array_length(auto_tags, 1) = 0 THEN 'Zero tags enabled'
    ELSE array_length(auto_tags, 1)::text || ' tags enabled'
  END as status
FROM tag_config
WHERE workspace_id = 'PASTE_WORKSPACE_ID_FROM_STEP_1_HERE';

-- 3. Check recent assets and their status
SELECT 
  a.id,
  a.workspace_id,
  a.auto_tag_status,
  a.tags,
  a.created_at
FROM assets a
WHERE a.workspace_id = 'PASTE_WORKSPACE_ID_FROM_STEP_1_HERE'
  AND a.deleted_at IS NULL
ORDER BY a.created_at DESC
LIMIT 5;

-- 4. If tag_config doesn't exist, create it:
/*
INSERT INTO tag_config (workspace_id, auto_tags)
VALUES (
  'PASTE_WORKSPACE_ID_FROM_STEP_1_HERE',
  ARRAY[]::text[]  -- Start empty, enable tags in UI
)
ON CONFLICT (workspace_id) DO NOTHING;
*/

-- 5. To enable tags for autotagging, update tag_config:
-- (Replace with actual tag names you want to enable)
/*
UPDATE tag_config
SET auto_tags = ARRAY['Product', 'Lifestyle', 'Studio']::text[]
WHERE workspace_id = 'PASTE_WORKSPACE_ID_FROM_STEP_1_HERE';
*/

