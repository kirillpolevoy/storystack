-- Check if user photo@kirillpolevoy.com has workspace access
-- Run this in Supabase SQL Editor

-- 1. Find the user ID
SELECT id, email FROM auth.users WHERE email = 'photo@kirillpolevoy.com';

-- 2. Check workspace memberships (replace USER_ID with the ID from above)
SELECT 
  wm.*,
  w.name as workspace_name,
  w.id as workspace_id
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'photo@kirillpolevoy.com');

-- 3. Check if user can see workspaces (test RLS)
SET ROLE authenticated;
SET request.jwt.claim.sub = (SELECT id::text FROM auth.users WHERE email = 'photo@kirillpolevoy.com');
SELECT * FROM workspace_members WHERE user_id = (SELECT id FROM auth.users WHERE email = 'photo@kirillpolevoy.com');
RESET ROLE;

-- 4. Check workspace_members RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'workspace_members';

-- 5. Check if is_workspace_member function works for this user
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  is_workspace_member(w.id) as can_access
FROM workspaces w
WHERE w.id IN (
  SELECT workspace_id FROM workspace_members 
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'photo@kirillpolevoy.com')
);

