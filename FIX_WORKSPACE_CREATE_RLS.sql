-- Fix workspace creation RLS policy
-- The policy should allow authenticated users to create workspaces

-- First, ensure RLS is enabled
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;

-- Create the INSERT policy
-- WITH CHECK is used for INSERT operations to validate the new row
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Grant necessary permissions (if not already granted)
-- The authenticated role should already have INSERT permission via RLS policy
-- But let's verify the table grants
GRANT INSERT ON workspaces TO authenticated;
GRANT SELECT ON workspaces TO authenticated;
GRANT UPDATE ON workspaces TO authenticated;

COMMENT ON POLICY "workspaces_insert_authenticated" ON workspaces IS 
  'Allows authenticated users to create workspaces where they are the creator';

-- Test query to verify policy (run as authenticated user)
-- This should return the policy details
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
WHERE tablename = 'workspaces' AND policyname = 'workspaces_insert_authenticated';
