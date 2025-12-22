-- Comprehensive fix for all stories in wrong workspaces
-- This ensures every story belongs to a workspace where the story owner is a member

-- Step 1: Show all stories that are in wrong workspaces
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id as current_workspace_id,
  w_current.name as current_workspace_name,
  s.user_id as story_owner_id,
  u.email as story_owner_email,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = s.workspace_id
      AND wm.user_id = s.user_id
    ) THEN '✅ OK'
    ELSE '❌ WRONG - Owner not a member!'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w_current ON w_current.id = s.workspace_id
WHERE s.deleted_at IS NULL
AND NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = s.workspace_id
  AND wm.user_id = s.user_id
)
ORDER BY u.email, s.created_at DESC;

-- Step 2: Fix ALL stories that are in wrong workspaces
-- Move each story to a workspace where the owner IS a member
UPDATE stories s
SET workspace_id = COALESCE(
  -- First priority: workspace created by story owner
  (SELECT w.id
   FROM workspaces w
   WHERE w.created_by = s.user_id
   ORDER BY w.created_at
   LIMIT 1),
  -- Second priority: any workspace where owner is a member (prefer owner role)
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
  -- Only update stories where owner is NOT a member of current workspace
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

-- Step 3: Verify all stories are now in correct workspaces
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  u.email as story_owner_email,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = s.workspace_id
      AND wm.user_id = s.user_id
    ) THEN '✅ OK'
    ELSE '❌ STILL HAS ISSUE - Owner not a member!'
  END as verification_status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.deleted_at IS NULL
ORDER BY u.email, s.created_at DESC;

-- Step 4: Specifically check malkari and ashmurak
SELECT 
  s.id as story_id,
  s.name as story_name,
  s.workspace_id,
  w.name as workspace_name,
  u.email as story_owner_email,
  CASE 
    WHEN u.email = 'malkari@gmail.com' AND w.created_by = (SELECT id FROM auth.users WHERE email = 'malkari@gmail.com') THEN '✅ Malkari in own workspace'
    WHEN u.email = 'ashmurak@gmail.com' AND w.created_by = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com') THEN '✅ Ashmurak in own workspace'
    WHEN u.email = 'malkari@gmail.com' AND w.created_by = (SELECT id FROM auth.users WHERE email = 'ashmurak@gmail.com') THEN '❌ Malkari in Ashmurak workspace!'
    WHEN u.email = 'ashmurak@gmail.com' AND w.created_by = (SELECT id FROM auth.users WHERE email = 'malkari@gmail.com') THEN '❌ Ashmurak in Malkari workspace!'
    ELSE '⚠️ Check manually'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.user_id IN (
  SELECT id FROM auth.users WHERE email IN ('malkari@gmail.com', 'ashmurak@gmail.com')
)
AND s.deleted_at IS NULL
ORDER BY u.email, s.created_at DESC;

