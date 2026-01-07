-- Fix process_workspace_invitations_for_user logic
-- The issue is that FOUND might not work correctly after ON CONFLICT DO NOTHING
-- We need to check membership explicitly and update invitation regardless

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
  v_user_id UUID;
  v_member_exists BOOLEAN;
BEGIN
  v_user_id := user_id; -- Store parameter in local variable to avoid ambiguity
  
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
      
      -- Check if user is already a member
      SELECT EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = v_workspace_id 
        AND wm.user_id = v_user_id
      ) INTO v_member_exists;
      
      -- Add user to workspace if not already a member (bypass RLS)
      IF NOT v_member_exists THEN
        INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
        VALUES (v_workspace_id, v_user_id, v_role, v_invited_by);
        
        RAISE NOTICE 'Added user % to workspace %', v_user_id, v_workspace_id;
      ELSE
        RAISE NOTICE 'User % already a member of workspace %', v_user_id, v_workspace_id;
      END IF;
      
      -- Mark invitation as accepted (always update, regardless of insert result)
      UPDATE workspace_invitations
      SET status = 'accepted',
          accepted_at = NOW()
      WHERE id = invitation_record.id;
      
      RAISE NOTICE 'Marked invitation % as accepted', invitation_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other invitations
      RAISE WARNING 'Error processing invitation %: %', invitation_record.id, SQLERRM;
      RAISE WARNING 'Error details: workspace_id=%, user_id=%, role=%', 
        v_workspace_id, v_user_id, v_role;
    END;
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_workspace_invitations_for_user(UUID, TEXT) TO authenticated;

-- Test: Process the specific pending invitation
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'photo@kirillpolevoy.com';
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(v_email);
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', v_email;
  ELSE
    RAISE NOTICE 'Processing invitations for user % (ID: %)', v_email, v_user_id;
    PERFORM process_workspace_invitations_for_user(v_user_id, v_email);
    RAISE NOTICE 'Done processing invitations for %', v_email;
  END IF;
END;
$$;

