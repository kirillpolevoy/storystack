-- Fix ashmurak's workspace issue
-- The problem: ashmurak's active workspace is set to "Malkari" workspace instead of her own

-- Step 1: Check ashmurak's workspace memberships
SELECT 
  '=== ASHMURAK WORKSPACE MEMBERSHIPS ===' as section;

SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.created_by,
  u.email as created_by_email,
  wm.role,
  CASE 
    WHEN w.created_by = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com') THEN '✅ OWN WORKSPACE'
    ELSE 'Shared workspace'
  END as type
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
JOIN auth.users u ON u.id = w.created_by
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com')
ORDER BY 
  CASE WHEN w.created_by = wm.user_id THEN 1 ELSE 2 END,
  w.created_at;

-- Step 2: Check current active workspace
SELECT 
  '=== CURRENT ACTIVE WORKSPACE ===' as section;

SELECT 
  u.email,
  up.active_workspace_id,
  w.name as active_workspace_name,
  w.created_by as workspace_owner_id,
  u2.email as workspace_owner_email,
  CASE 
    WHEN w.created_by = u.id THEN '✅ Own workspace'
    WHEN w.name = 'Malkari' THEN '❌ WRONG - Malkari workspace!'
    ELSE 'Shared workspace'
  END as status
FROM auth.users u
LEFT JOIN user_preferences up ON up.user_id = u.id
LEFT JOIN workspaces w ON w.id = up.active_workspace_id
LEFT JOIN auth.users u2 ON u2.id = w.created_by
WHERE u.email = 'ashmurak@gmail.com';

-- Step 3: Set ashmurak's active workspace to HER OWN workspace
WITH ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_own_workspace AS (
  SELECT w.id, w.name
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM ashmurak_user)
  ORDER BY w.created_at
  LIMIT 1
)
UPDATE user_preferences
SET 
  active_workspace_id = (SELECT id FROM ashmurak_own_workspace),
  updated_at = NOW()
WHERE user_id = (SELECT id FROM ashmurak_user)
AND (SELECT id FROM ashmurak_own_workspace) IS NOT NULL;

-- If no user_preferences record exists, create it
WITH ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_own_workspace AS (
  SELECT w.id, w.name
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM ashmurak_user)
  ORDER BY w.created_at
  LIMIT 1
)
INSERT INTO user_preferences (user_id, active_workspace_id, updated_at)
SELECT 
  (SELECT id FROM ashmurak_user),
  (SELECT id FROM ashmurak_own_workspace),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM user_preferences 
  WHERE user_id = (SELECT id FROM ashmurak_user)
)
AND (SELECT id FROM ashmurak_own_workspace) IS NOT NULL;

-- Step 4: Verify the fix
SELECT 
  '=== VERIFICATION ===' as section;

SELECT 
  u.email,
  up.active_workspace_id,
  w.name as active_workspace_name,
  w.created_by as workspace_owner_id,
  u2.email as workspace_owner_email,
  CASE 
    WHEN w.created_by = u.id THEN '✅ CORRECT - Own workspace'
    WHEN w.name = 'Malkari' THEN '❌ STILL WRONG - Malkari workspace!'
    ELSE '⚠️ Check manually'
  END as status
FROM auth.users u
LEFT JOIN user_preferences up ON up.user_id = u.id
LEFT JOIN workspaces w ON w.id = up.active_workspace_id
LEFT JOIN auth.users u2 ON u2.id = w.created_by
WHERE u.email = 'ashmurak@gmail.com';

-- Step 5: Show what stories ashmurak will see in her own workspace
SELECT 
  '=== STORIES IN ASHMURAK WORKSPACE (after fix) ===' as section;

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
  u.email as story_owner_email,
  CASE 
    WHEN u.email = 'ashmurak@gmail.com' THEN '✅ Ashmurak story'
    ELSE '❌ WRONG - Other user story!'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
WHERE s.workspace_id = (SELECT id FROM ashmurak_workspace)
AND s.deleted_at IS NULL
ORDER BY s.created_at DESC;

