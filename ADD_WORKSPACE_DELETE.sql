-- Add workspace deletion capability
-- Only workspace owners can delete workspaces

-- ============================================================================
-- PART 1: Create DELETE RLS policy
-- ============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Drop existing DELETE policy if any
DROP POLICY IF EXISTS "workspaces_delete_owner" ON workspaces;

-- Create DELETE policy - only owners can delete
CREATE POLICY "workspaces_delete_owner"
  ON workspaces 
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );

-- Ensure DELETE grant exists
GRANT DELETE ON workspaces TO authenticated;

COMMENT ON POLICY "workspaces_delete_owner" ON workspaces IS 
  'Allows workspace owners to delete their workspaces. Related data will cascade delete.';

-- ============================================================================
-- PART 2: Create RPC function for safe workspace deletion
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_workspace(workspace_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_owner BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to delete a workspace';
  END IF;

  -- Check if user is owner
  SELECT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_id_param
      AND wm.user_id = current_user_id
      AND wm.role = 'owner'
  ) INTO is_owner;

  IF NOT is_owner THEN
    RAISE EXCEPTION 'Only workspace owners can delete workspaces';
  END IF;

  -- Delete workspace (cascade will handle related data)
  -- Note: Assets and stories have ON DELETE RESTRICT, so deletion will fail
  -- if there are assets/stories. Consider soft delete or handle separately.
  DELETE FROM workspaces WHERE id = workspace_id_param;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_workspace(UUID) TO authenticated;

COMMENT ON FUNCTION delete_workspace IS 'Safely deletes a workspace. Only owners can delete. Returns error if workspace has assets/stories (ON DELETE RESTRICT).';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'DELETE Policy:' as check_type;
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'workspaces' AND cmd = 'DELETE';

SELECT 'Delete Function:' as check_type;
SELECT proname, prosecdef FROM pg_proc 
WHERE proname = 'delete_workspace';

