-- Combined workspace creation migrations
-- Run this in Supabase SQL Editor

-- ============================================================================
-- Migration 1: Create default workspace trigger for new users
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_workspace_for_user()
RETURNS TRIGGER AS $$
DECLARE
  workspace_id_val UUID;
BEGIN
  -- Create default workspace
  INSERT INTO workspaces (name, created_by, status)
  VALUES ('My Workspace', NEW.id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add user as owner
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, NEW.id, 'owner', NEW.id);
  
  -- Create default tag_config if needed
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_create_default_workspace ON auth.users;

CREATE TRIGGER trigger_create_default_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_workspace_for_user();

COMMENT ON FUNCTION create_default_workspace_for_user IS 'Automatically creates a default workspace named "My Workspace" for new users when they sign up';

-- ============================================================================
-- Migration 2: Create RPC function for workspace creation (bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_workspace(workspace_name TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_by UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_id_val UUID;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create a workspace';
  END IF;

  -- Create workspace
  INSERT INTO workspaces (name, created_by, status)
  VALUES (workspace_name, current_user_id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add creator as owner
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, current_user_id, 'owner', current_user_id);
  
  -- Create default tag_config
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  -- Return the created workspace
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.created_by,
    w.status,
    w.created_at,
    w.updated_at
  FROM workspaces w
  WHERE w.id = workspace_id_val;
END;
$$;

GRANT EXECUTE ON FUNCTION create_workspace(TEXT) TO authenticated;

COMMENT ON FUNCTION create_workspace IS 'Creates a new workspace for the authenticated user. Bypasses RLS using SECURITY DEFINER.';

-- ============================================================================
-- Migration 3: Fix SELECT policy to allow creators to see their workspaces
-- ============================================================================

-- The SELECT policy was blocking .select() after INSERT because the user
-- isn't a member yet. Add a policy for creators.
DROP POLICY IF EXISTS "workspaces_select_creator" ON workspaces;
CREATE POLICY "workspaces_select_creator"
  ON workspaces FOR SELECT
  USING (created_by = auth.uid());

-- ============================================================================
-- Migration 4: Fix workspace creation RLS policy (fallback)
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Drop all existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON workspaces;

-- Create INSERT policy (matching pattern from other working policies)
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Ensure proper grants
GRANT INSERT, SELECT, UPDATE, DELETE ON workspaces TO authenticated;

COMMENT ON POLICY "workspaces_insert_authenticated" ON workspaces IS 
  'Allows authenticated users to create workspaces where they are the creator';

-- Verify policies
SELECT 'INSERT Policies:' as check_type;
SELECT policyname, cmd, roles, with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

SELECT 'SELECT Policies:' as check_type;
SELECT policyname, cmd, qual as using_expression
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'SELECT';

