-- Test script to verify invitation creation works
-- Run this in Supabase SQL Editor

-- 1. Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'workspace_invitations'
    ) 
    THEN '✅ Table exists'
    ELSE '❌ Table does NOT exist - Run the migration first!'
  END AS table_status;

-- 2. Try to manually insert a test invitation (replace with your actual workspace_id)
-- First, get your workspace_id:
SELECT id, name FROM workspaces LIMIT 1;

-- Then try inserting (replace WORKSPACE_ID and USER_ID with actual values):
/*
INSERT INTO workspace_invitations (
  workspace_id,
  email,
  role,
  invited_by,
  status,
  expires_at
) VALUES (
  'WORKSPACE_ID_HERE',  -- Replace with actual workspace ID
  'test@example.com',
  'editor',
  'USER_ID_HERE',  -- Replace with your user ID (from auth.users)
  'pending',
  NOW() + INTERVAL '30 days'
) RETURNING *;
*/

-- 3. Check if you can see the invitation
SELECT * FROM workspace_invitations;

-- 4. Check RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'workspace_invitations';

