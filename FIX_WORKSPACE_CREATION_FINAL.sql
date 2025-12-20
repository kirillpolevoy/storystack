-- Final fix for workspace creation
-- The issue: SELECT policy blocks .select() after INSERT because user isn't a member yet

-- ============================================================================
-- Step 1: Create RPC function (bypasses RLS - this is the best solution)
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
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create a workspace';
  END IF;

  -- Create workspace (bypasses RLS)
  INSERT INTO workspaces (name, created_by, status)
  VALUES (workspace_name, current_user_id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add creator as owner (bypasses RLS)
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, current_user_id, 'owner', current_user_id);
  
  -- Create default tag_config (bypasses RLS)
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  -- Return workspace (bypasses RLS)
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

-- ============================================================================
-- Step 2: Fix SELECT policy to allow creators to see their workspaces
-- ============================================================================

-- Add a SELECT policy for creators (must come BEFORE the member check)
-- PostgreSQL evaluates policies in order, so this will be checked first
DROP POLICY IF EXISTS "workspaces_select_creator" ON workspaces;
CREATE POLICY "workspaces_select_creator"
  ON workspaces FOR SELECT
  USING (created_by = auth.uid());

-- The existing "workspaces_select_member" policy will still work for members
-- Both policies will be OR'd together, so either condition works

-- ============================================================================
-- Step 3: Ensure INSERT policy exists (fallback)
-- ============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- ============================================================================
-- Step 4: Verify
-- ============================================================================

SELECT 'RPC Function:' as check_type;
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'create_workspace';

SELECT 'SELECT Policies:' as check_type;
SELECT policyname, qual as using_expression FROM pg_policies 
WHERE tablename = 'workspaces' AND cmd = 'SELECT'
ORDER BY policyname;

SELECT 'INSERT Policies:' as check_type;
SELECT policyname, with_check FROM pg_policies 
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

