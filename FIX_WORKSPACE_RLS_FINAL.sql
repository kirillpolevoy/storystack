-- Final comprehensive fix for workspace creation RLS
-- Run this in Supabase SQL Editor

-- Step 1: Diagnostic - Check current state
SELECT '=== Current RLS Status ===' as diagnostic;
SELECT tablename, rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'workspaces';

SELECT '=== Current INSERT Policies ===' as diagnostic;
SELECT policyname, cmd, permissive, roles, with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

SELECT '=== Table Grants ===' as diagnostic;
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'workspaces'
  AND grantee IN ('authenticated', 'anon', 'public');

-- Step 2: Ensure RLS is enabled
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL existing INSERT policies
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON workspaces;

-- Step 4: Create the INSERT policy
-- Match the exact pattern from user_preferences_insert_own which works
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Step 5: Ensure all necessary grants exist
GRANT INSERT ON workspaces TO authenticated;
GRANT SELECT ON workspaces TO authenticated;
GRANT UPDATE ON workspaces TO authenticated;
GRANT DELETE ON workspaces TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 6: Verify the policy was created correctly
SELECT '=== New Policy Created ===' as diagnostic;
SELECT policyname, cmd, permissive, roles, with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

COMMENT ON POLICY "workspaces_insert_authenticated" ON workspaces IS 
  'Allows authenticated users to create workspaces where they are the creator';

