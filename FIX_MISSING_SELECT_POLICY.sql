-- Fix missing SELECT policy for workspace creators
-- This policy is CRITICAL for .select() after INSERT to work

-- Check current SELECT policies
SELECT 'Current SELECT policies:' as info;
SELECT policyname, qual FROM pg_policies 
WHERE tablename = 'workspaces' AND cmd = 'SELECT';

-- Create the missing creator SELECT policy
-- This allows users to SELECT workspaces they created (even before being added as members)
DROP POLICY IF EXISTS "workspaces_select_creator" ON workspaces;

CREATE POLICY "workspaces_select_creator"
  ON workspaces 
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Verify it was created
SELECT 'After fix - SELECT policies:' as info;
SELECT policyname, qual FROM pg_policies 
WHERE tablename = 'workspaces' AND cmd = 'SELECT'
ORDER BY policyname;

-- Both policies should now exist:
-- 1. workspaces_select_creator - for creators
-- 2. workspaces_select_member - for members
-- PostgreSQL will OR them together, so either condition works

