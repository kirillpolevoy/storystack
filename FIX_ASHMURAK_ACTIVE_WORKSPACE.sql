-- Fix ashmurak's active workspace issue
-- First, let's see what workspaces she has access to

-- 1. Find all workspaces ashmurak is a member of
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.created_by,
  u.email as created_by_email,
  wm.role,
  wm.created_at as member_since,
  CASE 
    WHEN w.created_by = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com') THEN '✅ Own workspace'
    ELSE 'Shared workspace'
  END as workspace_type
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
JOIN auth.users u ON u.id = w.created_by
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com')
ORDER BY 
  CASE WHEN w.created_by = wm.user_id THEN 1 ELSE 2 END, -- Own workspace first
  w.created_at;

-- 2. Set ashmurak's active workspace to her own workspace (the one she created)
WITH ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_own_workspace AS (
  SELECT w.id
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

-- 3. Verify the fix
SELECT 
  u.id as user_id,
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

-- 4. Also check what stories she would see with this active workspace
WITH ashmurak_user AS (
  SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com'
),
ashmurak_workspace AS (
  SELECT w.id
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
    WHEN s.workspace_id = (SELECT id FROM ashmurak_workspace) THEN '✅ In ashmurak workspace'
    ELSE '❌ In wrong workspace!'
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
ORDER BY s.workspace_id, s.created_at DESC;

