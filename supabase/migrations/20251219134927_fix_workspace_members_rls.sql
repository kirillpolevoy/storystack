-- Fix workspace_members RLS policy to allow users to query their own memberships
-- The current policy uses is_workspace_member(workspace_id) which requires knowing the workspace_id
-- But users need to query by user_id to find their workspaces

-- Drop the existing policy
DROP POLICY IF EXISTS "workspace_members_select_member" ON workspace_members;

-- Create a new policy that allows users to see their own memberships
CREATE POLICY "workspace_members_select_member"
  ON workspace_members FOR SELECT
  USING (
    -- Users can see their own memberships
    user_id = auth.uid()
    OR
    -- Users can see members of workspaces they belong to (for workspace member lists)
    is_workspace_member(workspace_id)
  );

-- Add comment
COMMENT ON POLICY "workspace_members_select_member" ON workspace_members IS 
  'Allows users to query their own workspace memberships and see members of workspaces they belong to';

