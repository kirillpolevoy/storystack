-- Fix workspace_members INSERT policy to allow trigger to insert first member
-- The issue is that the policy requires has_workspace_role, but when creating
-- the first member (owner), there are no members yet, so has_workspace_role fails

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "workspace_members_insert_admin" ON workspace_members;

-- Create new INSERT policy that allows:
-- 1. Admin+ members to add other members (existing behavior)
-- 2. Users to add themselves as the first member of a workspace they created
-- Note: In WITH CHECK, we reference columns from the NEW record being inserted
CREATE POLICY "workspace_members_insert_admin"
  ON workspace_members FOR INSERT
  WITH CHECK (
    -- Allow if user is admin+ of the workspace
    has_workspace_role(workspace_id, 'admin')
    OR
    -- Allow if user is creating themselves as the first member of a workspace they created
    (
      user_id = auth.uid()
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = workspace_members.workspace_id
          AND w.created_by = auth.uid()
      )
      -- Ensure this is the first member (no other members exist yet)
      -- Since we're inserting, checking for 0 existing members means this is the first
      AND NOT EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
      )
    )
  );

COMMENT ON POLICY "workspace_members_insert_admin" ON workspace_members IS 
  'Allows admin+ to add members, or users to add themselves as the first member of a workspace they created';

