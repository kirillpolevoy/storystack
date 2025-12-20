-- Test script to diagnose member email issues
-- Run this in your Supabase SQL Editor while logged in as the user having issues

-- 1. Check if the function exists
SELECT 
  proname as function_name,
  prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'get_workspace_members_with_emails';

-- 2. Test calling the function directly (replace YOUR_WORKSPACE_ID with actual UUID)
-- SELECT * FROM get_workspace_members_with_emails('YOUR_WORKSPACE_ID'::UUID);

-- 3. Check workspace_members table directly
SELECT 
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.created_at
FROM workspace_members wm
WHERE wm.workspace_id = 'YOUR_WORKSPACE_ID'::UUID;  -- Replace with actual workspace ID

-- 4. Try to get emails from auth.users (this will fail without SECURITY DEFINER)
-- SELECT u.id, u.email FROM auth.users u;

-- 5. Check if is_workspace_member function works
SELECT is_workspace_member('YOUR_WORKSPACE_ID'::UUID);  -- Replace with actual workspace ID

-- 6. Check profiles table
SELECT id, email FROM profiles WHERE id IN (
  SELECT user_id FROM workspace_members WHERE workspace_id = 'YOUR_WORKSPACE_ID'::UUID
);

