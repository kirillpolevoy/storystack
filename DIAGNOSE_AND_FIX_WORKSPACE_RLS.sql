-- Comprehensive fix for workspace creation RLS issue
-- Run this in Supabase SQL Editor

-- Step 1: Check current RLS status
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'workspaces';

-- Step 2: List all existing policies on workspaces
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'workspaces'
ORDER BY cmd, policyname;

-- Step 3: Ensure RLS is enabled
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL existing INSERT policies (to avoid conflicts)
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON workspaces;

-- Step 5: Create INSERT policy
-- For INSERT operations, only WITH CHECK is allowed (USING is not valid for INSERT)
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Step 6: Verify grants on the table
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'workspaces'
  AND grantee = 'authenticated';

-- Step 7: Ensure all necessary grants exist
GRANT ALL ON workspaces TO authenticated;

-- Step 8: Verify the new policy was created
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

-- Step 9: Test query (run as authenticated user to verify)
-- This should return the policy details
-- SELECT auth.uid() as current_user_id;

COMMENT ON POLICY "workspaces_insert_authenticated" ON workspaces IS 
  'Allows authenticated users to create workspaces where they are the creator';

