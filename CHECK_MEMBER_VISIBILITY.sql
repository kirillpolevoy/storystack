-- Check if members are visible with RLS
-- Run this in Supabase SQL Editor

-- 1. Check if the member exists (as admin, bypassing RLS)
SELECT 
  wm.*,
  u.email
FROM workspace_members wm
LEFT JOIN auth.users u ON u.id = wm.user_id
WHERE wm.workspace_id = '44412c88-1c26-4365-804b-a5752e1e6760'  -- Replace with your workspace_id
ORDER BY wm.created_at;

-- 2. Check RLS policy for workspace_members
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'workspace_members';

-- 3. Test the is_workspace_member function
-- Replace USER_ID with the user_id from the member above
SELECT is_workspace_member('44412c88-1c26-4365-804b-a5752e1e6760'::uuid);

-- 4. Check current user's workspace memberships
SELECT 
  wm.*,
  w.name as workspace_name
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = auth.uid();

