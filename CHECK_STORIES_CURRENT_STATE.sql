-- Check current state of stories for malkari and ashmurak
-- This will help us understand why stories are still showing up incorrectly

-- 1. Find user IDs
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email IN ('malkari@gmail.com', 'ashmurak@gmail.com', 'kpolevoy@gmail.com')
ORDER BY email;

-- 2. Check workspaces for these users
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.created_by,
  u.email as created_by_email,
  wm.user_id as member_user_id,
  u2.email as member_email,
  wm.role
FROM workspaces w
LEFT JOIN auth.users u ON u.id = w.created_by
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN auth.users u2 ON u2.id = wm.user_id
WHERE w.created_by IN (
  SELECT id FROM auth.users WHERE email IN ('malkari@gmail.com', 'ashmurak@gmail.com', 'kpolevoy@gmail.com')
)
OR wm.user_id IN (
  SELECT id FROM auth.users WHERE email IN ('malkari@gmail.com', 'ashmurak@gmail.com', 'kpolevoy@gmail.com')
)
ORDER BY w.created_at, wm.user_id;

-- 3. Check ALL stories and their workspace assignments
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  s.user_id as story_owner_id,
  u.email as story_owner_email,
  s.created_at,
  s.deleted_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = s.workspace_id
      AND wm.user_id = s.user_id
    ) THEN '✅ Owner is member'
    ELSE '❌ Owner NOT a member!'
  END as membership_status
FROM stories s
LEFT JOIN workspaces w ON w.id = s.workspace_id
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE s.user_id IN (
  SELECT id FROM auth.users WHERE email IN ('malkari@gmail.com', 'ashmurak@gmail.com', 'kpolevoy@gmail.com')
)
OR s.workspace_id IN (
  SELECT w.id FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id IN (
    SELECT id FROM auth.users WHERE email IN ('malkari@gmail.com', 'ashmurak@gmail.com', 'kpolevoy@gmail.com')
  )
)
ORDER BY u.email, s.created_at DESC;

-- 4. Specifically check: Are malkari's stories in ashmurak's workspace?
WITH malkari_user AS (
  SELECT id FROM auth.users WHERE email = 'malkari@gmail.com'
),
ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
malkari_workspace AS (
  SELECT w.id FROM workspaces w
  WHERE w.created_by = (SELECT id FROM malkari_user)
  ORDER BY w.created_at
  LIMIT 1
),
ashmurak_workspace AS (
  SELECT w.id FROM workspaces w
  WHERE w.created_by = (SELECT id FROM ashmurak_user)
  ORDER BY w.created_at
  LIMIT 1
)
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  CASE 
    WHEN s.workspace_id = (SELECT id FROM malkari_workspace) THEN 'Malkari workspace'
    WHEN s.workspace_id = (SELECT id FROM ashmurak_workspace) THEN 'Ashmurak workspace ⚠️ WRONG!'
    ELSE 'Other workspace'
  END as workspace_assignment,
  u.email as story_owner_email,
  s.created_at
FROM stories s
JOIN auth.users u ON u.id = s.user_id
WHERE s.user_id = (SELECT id FROM malkari_user)
AND s.deleted_at IS NULL
ORDER BY s.created_at DESC;

-- 5. Check what stories ashmurak would see when querying her workspace
WITH ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_workspace AS (
  SELECT w.id FROM workspaces w
  WHERE w.created_by = (SELECT id FROM ashmurak_user)
  ORDER BY w.created_at
  LIMIT 1
)
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  u.email as story_owner_email,
  CASE 
    WHEN s.workspace_id = (SELECT id FROM ashmurak_workspace) THEN '✅ Correct workspace'
    ELSE '❌ Wrong workspace!'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.deleted_at IS NULL
AND (
  -- Stories in ashmurak's workspace (what she should see)
  s.workspace_id = (SELECT id FROM ashmurak_workspace)
  OR
  -- Stories from workspaces ashmurak is a member of (what RLS allows)
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = s.workspace_id
    AND wm.user_id = (SELECT id FROM ashmurak_user)
  )
)
ORDER BY s.workspace_id, s.created_at DESC;

