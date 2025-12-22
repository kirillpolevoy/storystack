-- Deep diagnostic to find the exact problem
-- Run this and share ALL results

-- 1. Check ashmurak's user ID and workspaces
SELECT 
  '=== ASHMURAK USER INFO ===' as section;
  
SELECT 
  u.id as user_id,
  u.email,
  up.active_workspace_id,
  w.name as active_workspace_name,
  w.created_by as workspace_owner_id,
  u2.email as workspace_owner_email
FROM auth.users u
LEFT JOIN user_preferences up ON up.user_id = u.id
LEFT JOIN workspaces w ON w.id = up.active_workspace_id
LEFT JOIN auth.users u2 ON u2.id = w.created_by
WHERE u.email = 'ashmurak@gmail.com';

-- 2. Check ALL workspaces ashmurak is a member of
SELECT 
  '=== ASHMURAK WORKSPACES ===' as section;
  
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.created_by,
  u.email as created_by_email,
  wm.role,
  CASE 
    WHEN w.created_by = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com') THEN 'OWN'
    ELSE 'MEMBER'
  END as type
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
JOIN auth.users u ON u.id = w.created_by
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com')
ORDER BY 
  CASE WHEN w.created_by = wm.user_id THEN 1 ELSE 2 END,
  w.created_at;

-- 3. Check ALL stories and their workspace assignments
SELECT 
  '=== ALL STORIES ===' as section;
  
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  s.user_id as story_owner_id,
  u.email as story_owner_email,
  s.created_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = s.workspace_id
      AND wm.user_id = s.user_id
    ) THEN 'OK'
    ELSE 'OWNER NOT MEMBER!'
  END as membership_check
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.deleted_at IS NULL
AND (
  s.user_id IN (
    SELECT id FROM auth.users WHERE email IN ('ashmurak@gmail.com', 'malkari@gmail.com', 'kpolevoy@gmail.com')
  )
  OR s.workspace_id IN (
    SELECT w.id FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id IN (
      SELECT id FROM auth.users WHERE email IN ('ashmurak@gmail.com', 'malkari@gmail.com', 'kpolevoy@gmail.com')
    )
  )
)
ORDER BY u.email, s.created_at DESC;

-- 4. Specifically check: What stories are in ashmurak's workspace?
SELECT 
  '=== STORIES IN ASHMURAK WORKSPACE ===' as section;
  
WITH ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_workspace AS (
  SELECT w.id, w.name
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM ashmurak_user)
  ORDER BY w.created_at
  LIMIT 1
)
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  (SELECT name FROM ashmurak_workspace) as workspace_name,
  s.user_id as story_owner_id,
  u.email as story_owner_email,
  CASE 
    WHEN u.email = 'ashmurak@gmail.com' THEN '✅ Correct'
    ELSE '❌ WRONG OWNER!'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
WHERE s.workspace_id = (SELECT id FROM ashmurak_workspace)
AND s.deleted_at IS NULL
ORDER BY s.created_at DESC;

-- 5. Check what stories ashmurak CAN see via RLS (all workspaces she's a member of)
SELECT 
  '=== STORIES ASHMURAK CAN SEE (RLS) ===' as section;
  
WITH ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
)
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  u.email as story_owner_email,
  wm.role as ashmurak_role,
  CASE 
    WHEN s.workspace_id = (
      SELECT w2.id FROM workspaces w2
      WHERE w2.created_by = (SELECT id FROM ashmurak_user)
      ORDER BY w2.created_at LIMIT 1
    ) THEN 'In own workspace'
    ELSE 'In shared workspace'
  END as location
FROM stories s
JOIN auth.users u ON u.id = s.user_id
JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
JOIN workspaces w ON w.id = s.workspace_id
WHERE s.deleted_at IS NULL
AND wm.user_id = (SELECT id FROM ashmurak_user)
ORDER BY s.workspace_id, s.created_at DESC;

-- 6. Check if there are stories with NULL workspace_id
SELECT 
  '=== STORIES WITH NULL WORKSPACE_ID ===' as section;
  
SELECT 
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as affected_users
FROM stories
WHERE workspace_id IS NULL
AND deleted_at IS NULL;

