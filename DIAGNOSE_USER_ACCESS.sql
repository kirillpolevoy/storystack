-- Diagnostic query for photo@kirillpolevoy.com workspace access
-- Run this in Supabase SQL Editor

-- 1. Check if user exists
SELECT id, email, created_at FROM auth.users WHERE email = 'photo@kirillpolevoy.com';

-- 2. Check workspace_members (replace USER_ID with ID from step 1)
SELECT 
  wm.*,
  w.name as workspace_name
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'photo@kirillpolevoy.com');

-- 3. Check workspace_invitations
SELECT 
  wi.*,
  w.name as workspace_name
FROM workspace_invitations wi
JOIN workspaces w ON w.id = wi.workspace_id
WHERE wi.email = 'photo@kirillpolevoy.com';

-- 4. Check if process_workspace_invitations_for_user was called
-- (This would have been called during signup if implemented correctly)

-- 5. Test RLS - see what the user can actually query
-- First, get the user's JWT token (you'll need to be logged in as that user)
-- Or test with: SET ROLE authenticated; SET request.jwt.claim.sub = 'USER_ID_HERE';

-- 6. Manually add user to workspace if missing (replace USER_ID and WORKSPACE_ID)
/*
INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
SELECT 
  w.id as workspace_id,
  (SELECT id FROM auth.users WHERE email = 'photo@kirillpolevoy.com') as user_id,
  wi.role,
  wi.invited_by as created_by
FROM workspace_invitations wi
JOIN workspaces w ON w.id = wi.workspace_id
WHERE wi.email = 'photo@kirillpolevoy.com'
  AND wi.status = 'pending'
ON CONFLICT (workspace_id, user_id) DO NOTHING
RETURNING *;
*/

