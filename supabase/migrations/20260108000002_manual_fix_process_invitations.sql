-- Manual fix: Process pending invitations for users who already signed up
-- This can be run manually to fix invitations that weren't processed

-- First, let's improve the function to ensure it works
CREATE OR REPLACE FUNCTION process_workspace_invitations_for_user(user_id UUID, user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
  v_workspace_id UUID;
  v_role TEXT;
  v_invited_by UUID;
BEGIN
  -- Disable RLS for this session
  PERFORM set_config('row_security', 'off', false);
  
  -- Find all pending invitations for this user's email
  FOR invitation_record IN
    SELECT * FROM workspace_invitations
    WHERE email = LOWER(user_email)
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    BEGIN
      v_workspace_id := invitation_record.workspace_id;
      v_role := invitation_record.role;
      v_invited_by := invitation_record.invited_by;
      
      -- Add user to workspace (bypass RLS)
      INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
      VALUES (v_workspace_id, user_id, v_role, v_invited_by)
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
      
      -- Only update if insert succeeded or user already exists
      IF FOUND OR EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = v_workspace_id 
        AND wm.user_id = process_workspace_invitations_for_user.user_id
      ) THEN
        -- Mark invitation as accepted
        UPDATE workspace_invitations
        SET status = 'accepted',
            accepted_at = NOW()
        WHERE id = invitation_record.id;
        
        RAISE NOTICE 'Processed invitation % for user %', invitation_record.id, user_email;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other invitations
      RAISE WARNING 'Error processing invitation %: %', invitation_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_workspace_invitations_for_user(UUID, TEXT) TO authenticated;

-- Manual fix: Process all pending invitations for users who already exist
-- Run this to fix invitations that weren't processed during signup
DO $$
DECLARE
  user_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Find all users with pending invitations
  FOR user_record IN
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    JOIN workspace_invitations wi ON LOWER(wi.email) = LOWER(u.email)
    WHERE wi.status = 'pending'
      AND (wi.expires_at IS NULL OR wi.expires_at > NOW())
  LOOP
    BEGIN
      PERFORM process_workspace_invitations_for_user(user_record.id, user_record.email);
      processed_count := processed_count + 1;
      RAISE NOTICE 'Processed invitations for user: %', user_record.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to process invitations for user %: %', user_record.email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Processed invitations for % users', processed_count;
END;
$$;

