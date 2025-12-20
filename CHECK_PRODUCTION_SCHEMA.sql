-- Check current production schema state
-- Run this in Supabase SQL Editor to see what's actually in production

-- 1. Check if workspace_id columns exist
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('assets', 'stories', 'tag_config', 'workspaces', 'workspace_members')
  AND column_name IN ('workspace_id', 'user_id')
ORDER BY table_name, column_name;

-- 2. Check if workspaces table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'workspaces'
) as workspaces_table_exists;

-- 3. Check if workspace_members table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'workspace_members'
) as workspace_members_table_exists;

-- 4. Check tag_config structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tag_config'
ORDER BY ordinal_position;

-- 5. Check assets table structure (workspace_id vs user_id)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'assets'
  AND column_name IN ('workspace_id', 'user_id', 'campaign_id')
ORDER BY ordinal_position;

-- 6. Count how many assets have workspace_id vs user_id
SELECT 
  COUNT(*) as total_assets,
  COUNT(workspace_id) as assets_with_workspace_id,
  COUNT(user_id) as assets_with_user_id,
  COUNT(CASE WHEN workspace_id IS NULL AND user_id IS NULL THEN 1 END) as assets_with_neither
FROM assets
WHERE deleted_at IS NULL;

-- 7. Check if RLS policies use workspace_id or user_id
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('assets', 'tag_config', 'workspace_members')
  AND (qual LIKE '%workspace_id%' OR qual LIKE '%user_id%')
ORDER BY tablename, policyname;

