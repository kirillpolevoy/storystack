-- Verify RLS policies and user access
-- Run this in Supabase SQL Editor

-- 1. Check if user exists and get their ID
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE email = 'photo@kirillpolevoy.com';

-- 2. Check workspace_members (bypassing RLS to see actual data)
SELECT 
  wm.*,
  w.name as workspace_name,
  u.email as user_email
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
JOIN auth.users u ON u.id = wm.user_id
WHERE u.email = 'photo@kirillpolevoy.com';

-- 3. Test RLS policy - simulate what the user sees
-- Replace USER_ID_HERE with the user ID from step 1
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = (SELECT id::text FROM auth.users WHERE email = 'photo@kirillpolevoy.com');

-- Now test the query that the workspace switcher uses
SELECT 
  workspace_id,
  workspaces (
    id,
    name,
    logo_path
  )
FROM workspace_members
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'photo@kirillpolevoy.com');

RESET ROLE;

-- 4. Check workspace_members RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'workspace_members'
ORDER BY cmd, policyname;

-- 5. Test is_workspace_member function
-- Replace USER_ID and WORKSPACE_ID
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  is_workspace_member(w.id) as can_access
FROM workspaces w
WHERE w.id IN (
  SELECT workspace_id FROM workspace_members 
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'photo@kirillpolevoy.com')
);

-- 6. If user is missing from workspace_members, add them manually:
-- (Replace WORKSPACE_ID and ROLE with actual values from invitation)
/*
INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
SELECT 
  wi.workspace_id,
  (SELECT id FROM auth.users WHERE email = 'photo@kirillpolevoy.com') as user_id,
  wi.role,
  wi.invited_by as created_by
FROM workspace_invitations wi
WHERE wi.email = 'photo@kirillpolevoy.com'
  AND wi.status = 'pending'
LIMIT 1
ON CONFLICT (workspace_id, user_id) DO UPDATE
SET role = EXCLUDED.role
RETURNING *;
*/

