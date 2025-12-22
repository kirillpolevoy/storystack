-- Diagnose stories workspace issue
-- Check if stories are showing up in wrong workspaces

-- 1. Find user IDs for the two users
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email IN ('kpolevoy@gmail.com', 'ashmurak@gmail.com')
ORDER BY email;

-- 2. Find workspaces for these users
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.created_by,
  u.email as created_by_email,
  wm.user_id,
  u2.email as member_email,
  wm.role
FROM workspaces w
LEFT JOIN auth.users u ON u.id = w.created_by
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN auth.users u2 ON u2.id = wm.user_id
WHERE w.created_by IN (
  SELECT id FROM auth.users WHERE email IN ('kpolevoy@gmail.com', 'ashmurak@gmail.com')
)
OR wm.user_id IN (
  SELECT id FROM auth.users WHERE email IN ('kpolevoy@gmail.com', 'ashmurak@gmail.com')
)
ORDER BY w.created_at, wm.user_id;

-- 3. Check all stories and their workspace assignments
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  s.user_id,
  u.email as story_owner_email,
  s.created_at,
  s.deleted_at
FROM stories s
LEFT JOIN workspaces w ON w.id = s.workspace_id
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE s.user_id IN (
  SELECT id FROM auth.users WHERE email IN ('kpolevoy@gmail.com', 'ashmurak@gmail.com')
)
OR s.workspace_id IN (
  SELECT w.id FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id IN (
    SELECT id FROM auth.users WHERE email IN ('kpolevoy@gmail.com', 'ashmurak@gmail.com')
  )
)
ORDER BY s.created_at DESC;

-- 4. Check for stories with NULL workspace_id (shouldn't exist after migration)
SELECT 
  COUNT(*) as stories_with_null_workspace,
  COUNT(DISTINCT user_id) as affected_users
FROM stories
WHERE workspace_id IS NULL
AND deleted_at IS NULL;

-- 5. Check if stories from kpolevoy's workspace are accessible to ashmurak
-- (This simulates what RLS would allow)
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  s.user_id as story_owner_id,
  u.email as story_owner_email,
  wm.user_id as member_user_id,
  u2.email as member_email,
  wm.role,
  is_workspace_member(s.workspace_id) as rls_allows_access
FROM stories s
JOIN workspaces w ON w.id = s.workspace_id
JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
JOIN auth.users u ON u.id = s.user_id
JOIN auth.users u2 ON u2.id = wm.user_id
WHERE u.email = 'kpolevoy@gmail.com'
AND u2.email = 'ashmurak@gmail.com'
AND s.deleted_at IS NULL
ORDER BY s.created_at DESC;

-- 6. Check what stories ashmurak would see when querying her own workspace
-- First, find ashmurak's default workspace
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.created_by,
  u.email as created_by_email
FROM workspaces w
JOIN auth.users u ON u.id = w.created_by
WHERE w.created_by = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com')
ORDER BY w.created_at
LIMIT 1;

-- 7. Check if any stories from kpolevoy's workspace have workspace_id matching ashmurak's workspace
-- (This would indicate a data corruption issue)
WITH ashmurak_workspace AS (
  SELECT w.id as workspace_id
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com')
  ORDER BY w.created_at
  LIMIT 1
),
kpolevoy_stories AS (
  SELECT s.*
  FROM stories s
  JOIN auth.users u ON u.id = s.user_id
  WHERE u.email = 'kpolevoy@gmail.com'
  AND s.deleted_at IS NULL
)
SELECT 
  ks.id as story_id,
  ks.name as story_name,
  ks.workspace_id as story_workspace_id,
  aw.workspace_id as ashmurak_workspace_id,
  CASE 
    WHEN ks.workspace_id = aw.workspace_id THEN 'MATCH - This is the problem!'
    ELSE 'Different workspace'
  END as issue_status
FROM kpolevoy_stories ks
CROSS JOIN ashmurak_workspace aw
WHERE ks.workspace_id = aw.workspace_id;

