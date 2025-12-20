-- Diagnose autotagging issues
-- Run this in Supabase SQL Editor

-- 1. Check if tag_config exists for workspaces
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  tc.auto_tags,
  CASE 
    WHEN tc.auto_tags IS NULL THEN 'NULL'
    WHEN array_length(tc.auto_tags, 1) IS NULL THEN 'Empty array'
    WHEN array_length(tc.auto_tags, 1) = 0 THEN 'Zero length'
    ELSE array_length(tc.auto_tags, 1)::text || ' tags'
  END as tag_status
FROM workspaces w
LEFT JOIN tag_config tc ON tc.workspace_id = w.id
ORDER BY w.created_at DESC;

-- 2. Check assets with pending auto_tag_status
SELECT 
  a.id,
  a.workspace_id,
  w.name as workspace_name,
  a.auto_tag_status,
  a.created_at,
  a.tags
FROM assets a
JOIN workspaces w ON w.id = a.workspace_id
WHERE a.auto_tag_status = 'pending'
  AND a.deleted_at IS NULL
ORDER BY a.created_at DESC
LIMIT 20;

-- 3. Check if assets have workspace_id
SELECT 
  COUNT(*) as total_assets,
  COUNT(workspace_id) as assets_with_workspace_id,
  COUNT(*) - COUNT(workspace_id) as assets_missing_workspace_id
FROM assets
WHERE deleted_at IS NULL;

-- 4. Check tag_config RLS policy
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tag_config'
ORDER BY cmd, policyname;

-- 5. Test if service role can query tag_config (simulate edge function)
-- This should work since edge functions use service role
SELECT 
  workspace_id,
  auto_tags,
  COALESCE(array_length(auto_tags, 1), 0) as tag_count
FROM tag_config
ORDER BY workspace_id;

-- 6. Check recent assets and their workspace/tag_config status
SELECT 
  a.id,
  a.workspace_id,
  w.name as workspace_name,
  a.auto_tag_status,
  a.tags,
  tc.auto_tags as config_auto_tags,
  CASE 
    WHEN tc.auto_tags IS NULL THEN 'No tag_config'
    WHEN array_length(tc.auto_tags, 1) IS NULL OR array_length(tc.auto_tags, 1) = 0 THEN 'No tags enabled'
    ELSE array_length(tc.auto_tags, 1)::text || ' tags enabled'
  END as tagging_status
FROM assets a
JOIN workspaces w ON w.id = a.workspace_id
LEFT JOIN tag_config tc ON tc.workspace_id = a.workspace_id
WHERE a.deleted_at IS NULL
ORDER BY a.created_at DESC
LIMIT 10;

