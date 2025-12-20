-- Fix workspace access for photo@kirillpolevoy.com
-- Run this in Supabase SQL Editor

-- Step 1: Check current state
SELECT 
  'User exists' as check_type,
  COUNT(*) as count
FROM auth.users 
WHERE email = 'photo@kirillpolevoy.com'

UNION ALL

SELECT 
  'Workspace memberships' as check_type,
  COUNT(*) as count
FROM workspace_members wm
JOIN auth.users u ON u.id = wm.user_id
WHERE u.email = 'photo@kirillpolevoy.com'

UNION ALL

SELECT 
  'Pending invitations' as check_type,
  COUNT(*) as count
FROM workspace_invitations
WHERE email = 'photo@kirillpolevoy.com' AND status = 'pending';

-- Step 2: Get workspace ID from invitation (or from kpolevoy@gmail.com's workspace)
-- Replace WORKSPACE_ID with the actual workspace ID
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  wi.role as invited_role,
  wi.invited_by,
  wi.status as invitation_status
FROM workspace_invitations wi
JOIN workspaces w ON w.id = wi.workspace_id
WHERE wi.email = 'photo@kirillpolevoy.com'
ORDER BY wi.created_at DESC
LIMIT 1;

-- Step 3: Manually add user to workspace if missing
-- This will process any pending invitations
DO $$
DECLARE
  target_user_id UUID;
  invitation_record RECORD;
BEGIN
  -- Get user ID
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'photo@kirillpolevoy.com';
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User photo@kirillpolevoy.com not found';
  END IF;
  
  -- Process all pending invitations for this email
  FOR invitation_record IN
    SELECT * FROM workspace_invitations
    WHERE email = 'photo@kirillpolevoy.com'
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    -- Add user to workspace
    INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
    VALUES (
      invitation_record.workspace_id,
      target_user_id,
      invitation_record.role,
      invitation_record.invited_by
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role; -- Update role if already exists
    
    -- Mark invitation as accepted
    UPDATE workspace_invitations
    SET status = 'accepted',
        accepted_at = NOW()
    WHERE id = invitation_record.id;
    
    RAISE NOTICE 'Added user to workspace % with role %', invitation_record.workspace_id, invitation_record.role;
  END LOOP;
  
  RAISE NOTICE 'Done processing invitations for photo@kirillpolevoy.com';
END $$;

-- Step 4: Verify the fix
SELECT 
  wm.*,
  w.name as workspace_name,
  u.email as user_email
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
JOIN auth.users u ON u.id = wm.user_id
WHERE u.email = 'photo@kirillpolevoy.com';

