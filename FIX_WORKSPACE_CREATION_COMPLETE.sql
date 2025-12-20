-- Complete fix for workspace creation
-- This addresses both the RPC function and RLS policy issues

-- ============================================================================
-- Step 1: Create RPC function (bypasses RLS using SECURITY DEFINER)
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

  -- Create workspace (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO workspaces (name, created_by, status)
  VALUES (workspace_name, current_user_id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add creator as owner (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, current_user_id, 'owner', current_user_id);
  
  -- Create default tag_config (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  -- Return the created workspace (bypasses RLS due to SECURITY DEFINER)
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_workspace(TEXT) TO authenticated;

COMMENT ON FUNCTION create_workspace IS 'Creates a new workspace for the authenticated user. Bypasses RLS using SECURITY DEFINER.';

-- ============================================================================
-- Step 2: Fix RLS policies (for fallback direct insert)
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Drop all existing INSERT policies
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert_owner" ON workspaces;

-- Create a permissive INSERT policy
-- Note: When using .select() after INSERT, PostgreSQL may check SELECT policies
-- So we need to ensure the user can SELECT the workspace they just created
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- Ensure SELECT policy allows users to see workspaces they created
-- (even before they're added as members)
-- Check if this policy exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workspaces' 
    AND policyname = 'workspaces_select_creator'
  ) THEN
    CREATE POLICY "workspaces_select_creator"
      ON workspaces FOR SELECT
      USING (created_by = auth.uid());
  END IF;
END $$;

-- Ensure grants exist
GRANT INSERT, SELECT, UPDATE, DELETE ON workspaces TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- Step 3: Verify everything
-- ============================================================================

-- Check RPC function exists
SELECT 'RPC Function Status:' as check_type;
SELECT 
  proname as function_name,
  prosecdef as security_definer,
  proacl as permissions
FROM pg_proc
WHERE proname = 'create_workspace';

-- Check INSERT policies
SELECT 'INSERT Policies:' as check_type;
SELECT policyname, cmd, permissive, roles, with_check
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

-- Check SELECT policies
SELECT 'SELECT Policies:' as check_type;
SELECT policyname, cmd, permissive, roles, using_expression
FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'SELECT';

-- Check grants
SELECT 'Table Grants:' as check_type;
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'workspaces'
  AND grantee = 'authenticated';

