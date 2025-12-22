-- StoryStack Workspaces v1 - Workspace Invitations
-- Allows adding members to workspaces even if they don't have accounts yet

-- ============================================================================
-- 1. CREATE WORKSPACE_INVITATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ NULL,
  UNIQUE(workspace_id, email, status) -- One pending invitation per email per workspace
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON workspace_invitations(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email_status ON workspace_invitations(email, status) WHERE status = 'pending';

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE RLS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "workspace_invitations_select_member" ON workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_insert_admin" ON workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_update_admin" ON workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_delete_admin" ON workspace_invitations;

-- SELECT: Workspace members can view invitations for their workspace
CREATE POLICY "workspace_invitations_select_member"
  ON workspace_invitations FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT: Admin+ can create invitations
CREATE POLICY "workspace_invitations_insert_admin"
  ON workspace_invitations FOR INSERT
  WITH CHECK (
    has_workspace_role(workspace_id, 'admin')
  );

-- UPDATE: Admin+ can update invitations (e.g., mark as accepted)
CREATE POLICY "workspace_invitations_update_admin"
  ON workspace_invitations FOR UPDATE
  USING (has_workspace_role(workspace_id, 'admin'))
  WITH CHECK (has_workspace_role(workspace_id, 'admin'));

-- DELETE: Admin+ can delete invitations
CREATE POLICY "workspace_invitations_delete_admin"
  ON workspace_invitations FOR DELETE
  USING (has_workspace_role(workspace_id, 'admin'));

-- ============================================================================
-- 5. CREATE FUNCTION TO PROCESS INVITATIONS ON SIGNUP
-- ============================================================================

-- Function to process pending invitations when a user signs up
-- This should be called after a user successfully signs up
-- Can be called from the application or via a Supabase webhook
CREATE OR REPLACE FUNCTION process_workspace_invitations_for_user(user_id UUID, user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Find all pending invitations for this user's email
  FOR invitation_record IN
    SELECT * FROM workspace_invitations
    WHERE email = LOWER(user_email)
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    -- Add user to workspace
    INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
    VALUES (
      invitation_record.workspace_id,
      user_id,
      invitation_record.role,
      invitation_record.invited_by
    )
    ON CONFLICT (workspace_id, user_id) DO NOTHING; -- Ignore if already a member
    
    -- Mark invitation as accepted
    UPDATE workspace_invitations
    SET status = 'accepted',
        accepted_at = NOW()
    WHERE id = invitation_record.id;
  END LOOP;
END;
$$;

-- ============================================================================
-- 6. GRANT EXECUTE PERMISSIONS
-- ============================================================================

-- Allow authenticated users to call this function (for processing their own invitations)
GRANT EXECUTE ON FUNCTION process_workspace_invitations_for_user(UUID, TEXT) TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE workspace_invitations IS 'Pending workspace invitations for users who have not yet signed up';
COMMENT ON FUNCTION process_workspace_invitations_for_user IS 'Process pending workspace invitations when a user signs up with a matching email';

