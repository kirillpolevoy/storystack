-- Complete fix for workspace creation RLS
-- This should resolve the 403/42501 error

-- Step 1: Check current state
SELECT 'Current RLS status:' as info;
SELECT tablename, rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'workspaces';

SELECT 'Current INSERT policies:' as info;
SELECT policyname, cmd, roles, with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

-- Step 2: Ensure RLS is enabled
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL existing INSERT policies
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON workspaces;

-- Step 4: Create the INSERT policy (matching the pattern from other working policies)
-- Don't specify TO authenticated - let it apply to all roles, the WITH CHECK will filter
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Step 5: Verify grants exist
GRANT INSERT, SELECT, UPDATE, DELETE ON workspaces TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 6: Verify the policy was created
SELECT 'New policy created:' as info;
SELECT policyname, cmd, roles, with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

-- Step 7: Test the policy (this query should work if you're authenticated)
-- SELECT auth.uid() as current_user_id;

COMMENT ON POLICY "workspaces_insert_authenticated" ON workspaces IS 
  'Allows authenticated users to create workspaces where they are the creator';

