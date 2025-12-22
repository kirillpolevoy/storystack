-- Complete fix for ashmurak's workspace issue
-- This will:
-- 1. Find her workspace(s)
-- 2. Set her active workspace correctly
-- 3. Fix any stories in wrong workspaces
-- 4. Verify everything is correct

-- Step 1: Show all workspaces ashmurak has access to
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.created_by,
  u.email as created_by_email,
  wm.role,
  CASE 
    WHEN w.created_by = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com') THEN '✅ Own workspace'
    ELSE 'Shared workspace'
  END as workspace_type
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
JOIN auth.users u ON u.id = w.created_by
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com')
ORDER BY 
  CASE WHEN w.created_by = wm.user_id THEN 1 ELSE 2 END,
  w.created_at;

-- Step 2: Set ashmurak's active workspace to her own workspace
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
ON CONFLICT (user_id) 
DO UPDATE SET 
  active_workspace_id = (SELECT id FROM ashmurak_own_workspace),
  updated_at = NOW()
WHERE (SELECT id FROM ashmurak_own_workspace) IS NOT NULL;

-- Step 3: Fix stories - ensure all stories belong to workspaces where owner is a member
UPDATE stories s
SET workspace_id = COALESCE(
  -- First: workspace created by story owner
  (SELECT w.id
   FROM workspaces w
   WHERE w.created_by = s.user_id
   ORDER BY w.created_at
   LIMIT 1),
  -- Fallback: any workspace owner is a member of
  (SELECT wm.workspace_id
   FROM workspace_members wm
   WHERE wm.user_id = s.user_id
   ORDER BY CASE wm.role 
     WHEN 'owner' THEN 1
     WHEN 'admin' THEN 2
     WHEN 'editor' THEN 3
     ELSE 4
   END, wm.created_at
   LIMIT 1)
)
WHERE s.deleted_at IS NULL
AND NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = s.workspace_id
  AND wm.user_id = s.user_id
)
AND COALESCE(
  (SELECT w.id
   FROM workspaces w
   WHERE w.created_by = s.user_id
   ORDER BY w.created_at
   LIMIT 1),
  (SELECT wm.workspace_id
   FROM workspace_members wm
   WHERE wm.user_id = s.user_id
   ORDER BY CASE wm.role 
     WHEN 'owner' THEN 1
     WHEN 'admin' THEN 2
     WHEN 'editor' THEN 3
     ELSE 4
   END, wm.created_at
   LIMIT 1)
) IS NOT NULL;

-- Step 4: Verify - Check what stories ashmurak will see
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
  w.name as workspace_name,
  u.email as story_owner_email,
  CASE 
    WHEN s.workspace_id = (SELECT id FROM ashmurak_workspace) AND u.email = 'ashmurak@gmail.com' THEN '✅ Correct - Ashmurak story in her workspace'
    WHEN s.workspace_id = (SELECT id FROM ashmurak_workspace) AND u.email != 'ashmurak@gmail.com' THEN '❌ WRONG - Other user story in ashmurak workspace!'
    WHEN s.workspace_id != (SELECT id FROM ashmurak_workspace) AND u.email = 'ashmurak@gmail.com' THEN '❌ WRONG - Ashmurak story in wrong workspace!'
    ELSE '⚠️ Story from shared workspace (might be OK)'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.deleted_at IS NULL
AND (
  -- Stories in ashmurak's workspace (what getStories would return)
  s.workspace_id = (SELECT id FROM ashmurak_workspace)
  OR
  -- Stories from workspaces ashmurak is a member of (what RLS allows)
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = s.workspace_id
    AND wm.user_id = (SELECT id FROM ashmurak_user)
  )
)
ORDER BY 
  CASE WHEN s.workspace_id = (SELECT id FROM ashmurak_workspace) THEN 1 ELSE 2 END,
  u.email,
  s.created_at DESC;

-- Step 5: Final verification - Check active workspace is set correctly
SELECT 
  u.email,
  up.active_workspace_id,
  w.name as active_workspace_name,
  w.created_by as workspace_owner_id,
  u2.email as workspace_owner_email,
  CASE 
    WHEN up.active_workspace_id IS NULL THEN '⚠️ No active workspace set'
    WHEN w.created_by = u.id THEN '✅ Own workspace'
    WHEN EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = up.active_workspace_id
      AND wm.user_id = u.id
    ) THEN '✅ Member of workspace'
    ELSE '❌ NOT a member of active workspace!'
  END as status
FROM auth.users u
LEFT JOIN user_preferences up ON up.user_id = u.id
LEFT JOIN workspaces w ON w.id = up.active_workspace_id
LEFT JOIN auth.users u2 ON u2.id = w.created_by
WHERE u.email = 'ashmurak@gmail.com';

