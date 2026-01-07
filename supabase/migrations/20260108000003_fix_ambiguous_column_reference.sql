-- Fix ambiguous column reference in process_workspace_invitations_for_user

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
      
      -- Add user to workspace (bypass RLS)
      INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
      VALUES (v_workspace_id, v_user_id, v_role, v_invited_by)
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
      
      -- Only update if insert succeeded or user already exists
      IF FOUND OR EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = v_workspace_id 
        AND wm.user_id = v_user_id
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

