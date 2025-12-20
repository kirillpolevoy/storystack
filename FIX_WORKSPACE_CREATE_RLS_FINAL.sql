-- Final fix for workspace creation RLS policy
-- This ensures authenticated users can create workspaces

-- Step 1: Ensure RLS is enabled
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON workspaces;

-- Step 3: Create a simple, permissive INSERT policy
-- This allows any authenticated user to create a workspace
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Step 4: Ensure proper grants
GRANT INSERT ON workspaces TO authenticated;
GRANT SELECT ON workspaces TO authenticated;
GRANT UPDATE ON workspaces TO authenticated;
GRANT DELETE ON workspaces TO authenticated;

-- Step 5: Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

-- Step 6: Test query (this should show the policy)
-- SELECT * FROM pg_policies WHERE tablename = 'workspaces';

COMMENT ON POLICY "workspaces_insert_authenticated" ON workspaces IS 
  'Allows authenticated users to create workspaces where they are the creator';

