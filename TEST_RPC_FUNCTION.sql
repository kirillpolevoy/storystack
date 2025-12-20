-- Test the RPC function directly
-- Run this in Supabase SQL Editor while logged in

-- 1. Check if function exists
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'get_workspace_members_with_emails';

-- 2. Get your current user ID
SELECT auth.uid() as current_user_id;

-- 3. Find your workspaces
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  wm.role as your_role
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
WHERE wm.user_id = auth.uid();

-- 4. Test the RPC function with one of your workspace IDs
-- Replace 'YOUR-WORKSPACE-ID' with an actual workspace ID from step 3
-- SELECT * FROM get_workspace_members_with_emails('YOUR-WORKSPACE-ID'::UUID);

-- 5. Test direct query to see if RLS is blocking
SELECT 
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.created_at
FROM workspace_members wm
WHERE wm.workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
);

