-- Fix malkari's stories that are incorrectly in ashmurak's workspace
-- This is a targeted fix for the specific issue

-- Step 1: Find malkari's workspace
WITH malkari_user AS (
  SELECT id FROM auth.users WHERE email = 'malkari@gmail.com'
),
malkari_workspace AS (
  SELECT w.id, w.name
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM malkari_user)
  ORDER BY w.created_at
  LIMIT 1
),
ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_workspace AS (
  SELECT w.id, w.name
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM ashmurak_user)
  ORDER BY w.created_at
  LIMIT 1
)
-- Show what we're about to fix
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id as current_workspace_id,
  (SELECT name FROM ashmurak_workspace) as current_workspace_name,
  (SELECT id FROM malkari_workspace) as correct_workspace_id,
  (SELECT name FROM malkari_workspace) as correct_workspace_name,
  u.email as story_owner_email
FROM stories s
JOIN auth.users u ON u.id = s.user_id
WHERE s.user_id = (SELECT id FROM malkari_user)
AND s.workspace_id = (SELECT id FROM ashmurak_workspace)
AND s.deleted_at IS NULL;

-- Step 2: Fix malkari's stories - move them to malkari's workspace
WITH malkari_user AS (
  SELECT id FROM auth.users WHERE email = 'malkari@gmail.com'
),
malkari_workspace AS (
  SELECT w.id
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM malkari_user)
  ORDER BY w.created_at
  LIMIT 1
),
ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_workspace AS (
  SELECT w.id
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM ashmurak_user)
  ORDER BY w.created_at
  LIMIT 1
)
UPDATE stories s
SET workspace_id = (SELECT id FROM malkari_workspace)
WHERE s.user_id = (SELECT id FROM malkari_user)
AND s.workspace_id = (SELECT id FROM ashmurak_workspace)
AND s.deleted_at IS NULL
AND (SELECT id FROM malkari_workspace) IS NOT NULL;

-- Step 3: Verify the fix
WITH malkari_user AS (
  SELECT id FROM auth.users WHERE email = 'malkari@gmail.com'
),
malkari_workspace AS (
  SELECT w.id, w.name
  FROM workspaces w
  WHERE w.created_by = (SELECT id FROM malkari_user)
  ORDER BY w.created_at
  LIMIT 1
),
ashmurak_user AS (
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
  w.name as workspace_name,
  u.email as story_owner_email,
  CASE 
    WHEN s.workspace_id = (SELECT id FROM malkari_workspace) AND u.email = 'malkari@gmail.com' THEN '✅ Correct'
    WHEN s.workspace_id = (SELECT id FROM ashmurak_workspace) AND u.email = 'ashmurak@gmail.com' THEN '✅ Correct'
    WHEN s.workspace_id = (SELECT id FROM ashmurak_workspace) AND u.email = 'malkari@gmail.com' THEN '❌ STILL WRONG!'
    ELSE '⚠️ Check manually'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.user_id IN ((SELECT id FROM malkari_user), (SELECT id FROM ashmurak_user))
AND s.deleted_at IS NULL
ORDER BY u.email, s.created_at DESC;

