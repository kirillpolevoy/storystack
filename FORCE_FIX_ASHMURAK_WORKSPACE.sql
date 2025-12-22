-- FORCE FIX: Ensure ashmurak's active workspace is definitely correct
-- This will override any cached values

-- Step 1: Find ashmurak's own workspace
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
-- Step 2: Force set active workspace to her own workspace
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

-- Step 3: Verify
SELECT 
  u.email,
  up.active_workspace_id,
  w.name as active_workspace_name,
  w.created_by as workspace_owner_id,
  u2.email as workspace_owner_email,
  CASE 
    WHEN w.created_by = u.id THEN '✅ CORRECT - Own workspace'
    ELSE '❌ WRONG!'
  END as status
FROM auth.users u
LEFT JOIN user_preferences up ON up.user_id = u.id
LEFT JOIN workspaces w ON w.id = up.active_workspace_id
LEFT JOIN auth.users u2 ON u2.id = w.created_by
WHERE u.email = 'ashmurak@gmail.com';

-- Step 4: Show what stories will be returned
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
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  u.email as story_owner_email,
  CASE 
    WHEN u.email = 'ashmurak@gmail.com' THEN '✅ Ashmurak story'
    ELSE '❌ WRONG - Other user story!'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.workspace_id = (SELECT active_workspace_id FROM ashmurak_active_workspace)
AND s.deleted_at IS NULL
ORDER BY s.created_at DESC;

