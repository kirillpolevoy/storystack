-- Fix process_workspace_invitations_for_user to explicitly bypass RLS
-- Use PERFORM set_config instead of SET LOCAL for better compatibility
-- Add error handling

-- Drop and recreate to change implementation
DROP FUNCTION IF EXISTS process_workspace_invitations_for_user(UUID, TEXT);

CREATE FUNCTION process_workspace_invitations_for_user(user_id UUID, user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Explicitly disable RLS for this function's operations
  PERFORM set_config('row_security', 'off', true);
  
  -- Find all pending invitations for this user's email
  FOR invitation_record IN
    SELECT * FROM workspace_invitations
    WHERE email = LOWER(user_email)
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    BEGIN
      -- Add user to workspace (bypass RLS)
      INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
      VALUES (
        invitation_record.workspace_id,
        user_id,
        invitation_record.role,
        invitation_record.invited_by
      )
      ON CONFLICT (workspace_id, user_id) DO NOTHING; -- Ignore if already a member
      
      -- Mark invitation as accepted (bypass RLS)
      UPDATE workspace_invitations
      SET status = 'accepted',
          accepted_at = NOW()
      WHERE id = invitation_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other invitations
      RAISE WARNING 'Error processing invitation %: %', invitation_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION process_workspace_invitations_for_user IS 'Process pending workspace invitations when a user signs up with a matching email. Bypasses RLS to allow updating invitations and inserting members.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_workspace_invitations_for_user(UUID, TEXT) TO authenticated;

