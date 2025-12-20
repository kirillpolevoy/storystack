-- Fix RLS Policies - Remove Duplicate/Conflicting Policies
-- Production has both user_id and workspace_id policies, which can conflict

-- ============================================================================
-- STEP 1: Check Current State
-- ============================================================================

-- Check if assets have both user_id and workspace_id
SELECT 
  COUNT(*) as total_assets,
  COUNT(user_id) as assets_with_user_id,
  COUNT(workspace_id) as assets_with_workspace_id,
  COUNT(CASE WHEN user_id IS NOT NULL AND workspace_id IS NOT NULL THEN 1 END) as assets_with_both,
  COUNT(CASE WHEN user_id IS NULL AND workspace_id IS NULL THEN 1 END) as assets_with_neither
FROM assets
WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 2: Remove Old user_id-based Policies (if workspace_id exists)
-- ============================================================================

-- Only run this if assets have workspace_id
-- If all assets have workspace_id, remove old user_id policies

-- Drop old SELECT policy
DROP POLICY IF EXISTS "Users can only see their own assets" ON assets;

-- Drop old UPDATE policy  
DROP POLICY IF EXISTS "Users can only update their own assets" ON assets;

-- Drop old DELETE policy
DROP POLICY IF EXISTS "Users can only delete their own assets" ON assets;

-- ============================================================================
-- STEP 3: Ensure Workspace-based Policies Exist
-- ============================================================================

-- These should already exist, but verify:

-- SELECT: Workspace members can see assets
-- Policy name: assets_select_member
-- Should exist: is_workspace_member(workspace_id)

-- UPDATE: Editors can update assets
-- Policy name: assets_update_editor  
-- Should exist: has_workspace_role(workspace_id, 'editor')

-- INSERT: Editors can insert assets
-- Check if INSERT policy exists
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'assets'
  AND cmd = 'INSERT';

-- If no INSERT policy exists, create one:
-- CREATE POLICY assets_insert_editor ON assets
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (has_workspace_role(workspace_id, 'editor'));

-- DELETE: Editors can delete assets (soft delete via UPDATE, or hard delete)
-- Check if DELETE policy exists
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'assets'
  AND cmd = 'DELETE';

-- If no DELETE policy exists, create one:
-- CREATE POLICY assets_delete_editor ON assets
--   FOR DELETE
--   TO authenticated
--   USING (has_workspace_role(workspace_id, 'editor'));

-- ============================================================================
-- STEP 4: Verify Policies After Cleanup
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('assets', 'tag_config', 'workspace_members')
ORDER BY tablename, cmd, policyname;

