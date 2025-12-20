-- Fix ALL workspace creation issues
-- 1. Fix ambiguous column reference in RPC function
-- 2. Fix workspace_members INSERT policy to allow adding first owner

-- ============================================================================
-- PART 1: Fix RPC function (ambiguous column reference)
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_workspace(TEXT);

CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name TEXT)
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

  -- Create workspace
  INSERT INTO workspaces (name, created_by, status)
  VALUES (workspace_name, current_user_id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add creator as owner (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, current_user_id, 'owner', current_user_id);
  
  -- Create default tag_config
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  -- Return workspace (explicitly qualify all columns)
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

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

-- ============================================================================
-- PART 2: Fix workspace_members INSERT policy
-- ============================================================================

-- The current policy requires admin role, but when creating a workspace,
-- the user isn't an admin yet (chicken-and-egg problem)
-- Solution: Allow users to add themselves as owner when creating workspace

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "workspace_members_insert_admin" ON workspace_members;

-- Create policy that allows:
-- 1. Admins to add members (existing behavior)
-- 2. Users to add themselves as owner when creating workspace
CREATE POLICY "workspace_members_insert_admin"
  ON workspace_members 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if user is adding themselves as owner (workspace creation case)
    (user_id = auth.uid() AND role = 'owner' AND created_by = auth.uid())
    OR
    -- Allow if user has admin+ role in the workspace
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- PART 3: Ensure workspace INSERT policy exists
-- ============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
  );

-- ============================================================================
-- PART 4: Ensure SELECT policy for creators exists
-- ============================================================================

DROP POLICY IF EXISTS "workspaces_select_creator" ON workspaces;
CREATE POLICY "workspaces_select_creator"
  ON workspaces 
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'RPC Function:' as check_type;
SELECT proname, prosecdef FROM pg_proc 
WHERE proname = 'create_workspace';

SELECT 'workspace_members INSERT Policy:' as check_type;
SELECT policyname, with_check FROM pg_policies
WHERE tablename = 'workspace_members' AND cmd = 'INSERT';

SELECT 'workspaces INSERT Policy:' as check_type;
SELECT policyname, with_check FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'INSERT';

SELECT 'workspaces SELECT Policies:' as check_type;
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'SELECT'
ORDER BY policyname;

