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
  -- Note: We need to handle assets and stories that have ON DELETE RESTRICT
  -- by either changing the constraint or deleting them first
  
  -- Delete all assets in the workspace (including soft-deleted ones)
  -- This will cascade delete asset_tags, story_assets references
  DELETE FROM assets WHERE workspace_id = workspace_id_param;
  
  -- Delete all stories in the workspace (including soft-deleted ones)
  -- This will cascade delete story_assets
  DELETE FROM stories WHERE workspace_id = workspace_id_param;
  
  -- Delete workspace (cascade will handle remaining related data like workspace_members, tags, etc.)
  DELETE FROM workspaces WHERE id = workspace_id_param;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_workspace(UUID) TO authenticated;

COMMENT ON FUNCTION delete_workspace IS 'Safely deletes a workspace and all its data. Only owners can delete. Deletes all assets and stories in the workspace before deleting the workspace itself.';

