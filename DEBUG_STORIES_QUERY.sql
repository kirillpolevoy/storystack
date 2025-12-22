-- Debug: Check what stories ashmurak would see with current active workspace
-- This simulates what the app query would return

-- Step 1: Check ashmurak's current active workspace
SELECT 
  '=== ASHMURAK ACTIVE WORKSPACE ===' as section;

SELECT 
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

-- Step 2: Simulate the exact query the app would run
-- This is what getStories(activeWorkspaceId) would return
WITH ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_active_workspace AS (
  SELECT up.active_workspace_id
  FROM user_preferences up
  JOIN auth.users u ON u.id = up.user_id
  WHERE u.email = 'ashmurak@gmail.com'
)
SELECT 
  '=== STORIES FROM ACTIVE WORKSPACE (what app would return) ===' as section,
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  s.user_id as story_owner_id,
  u.email as story_owner_email,
  s.created_at
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.workspace_id = (SELECT active_workspace_id FROM ashmurak_active_workspace)
AND s.deleted_at IS NULL
ORDER BY s.updated_at DESC;

-- Step 3: Check what RLS would allow (all workspaces ashmurak is a member of)
SELECT 
  '=== ALL STORIES ASHMURAK CAN SEE (RLS) ===' as section;

SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  u.email as story_owner_email,
  wm.role as ashmurak_role
FROM stories s
JOIN auth.users u ON u.id = s.user_id
JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
JOIN workspaces w ON w.id = s.workspace_id
WHERE s.deleted_at IS NULL
AND wm.user_id = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com')
ORDER BY s.workspace_id, s.created_at DESC;

-- Step 4: Check if activeWorkspaceId might be NULL or wrong
SELECT 
  '=== CHECK FOR NULL/WRONG ACTIVE WORKSPACE ===' as section;

SELECT 
  u.email,
  up.active_workspace_id,
  CASE 
    WHEN up.active_workspace_id IS NULL THEN '❌ NULL - Will use getOrCreateDefaultWorkspace'
    WHEN NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = up.active_workspace_id
      AND wm.user_id = u.id
    ) THEN '❌ NOT A MEMBER - Wrong workspace!'
    WHEN w.created_by != u.id THEN '⚠️ Shared workspace (might be OK)'
    ELSE '✅ Own workspace'
  END as status
FROM auth.users u
LEFT JOIN user_preferences up ON up.user_id = u.id
LEFT JOIN workspaces w ON w.id = up.active_workspace_id
WHERE u.email = 'ashmurak@gmail.com';

