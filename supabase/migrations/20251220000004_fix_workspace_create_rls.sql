-- Fix workspace creation RLS policy
-- Ensure authenticated users can create workspaces

-- Ensure RLS is enabled
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Drop all existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON workspaces;

-- Create INSERT policy (matching pattern from other working policies)
-- Don't specify TO authenticated - PostgreSQL will check roles automatically
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Ensure permissions are granted
GRANT INSERT, SELECT, UPDATE ON workspaces TO authenticated;

COMMENT ON POLICY "workspaces_insert_authenticated" ON workspaces IS 
  'Allows authenticated users to create workspaces where they are the creator';

