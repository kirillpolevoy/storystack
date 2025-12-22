-- NUCLEAR FIX - Fixes everything at once
-- Run this ENTIRE script in Supabase SQL Editor

BEGIN;

-- Step 1: Find and fix ashmurak's active workspace
DO $$
DECLARE
  ashmurak_user_id UUID;
  ashmurak_workspace_id UUID;
BEGIN
  -- Get ashmurak's user ID
  SELECT id INTO ashmurak_user_id
  FROM auth.users
  WHERE email = 'ashmurak@gmail.com';
  
  IF ashmurak_user_id IS NULL THEN
    RAISE EXCEPTION 'ashmurak@gmail.com not found';
  END IF;
  
  -- Get ashmurak's own workspace (the one she created)
  SELECT w.id INTO ashmurak_workspace_id
  FROM workspaces w
  WHERE w.created_by = ashmurak_user_id
  ORDER BY w.created_at
  LIMIT 1;
  
  IF ashmurak_workspace_id IS NULL THEN
    RAISE EXCEPTION 'ashmurak has no workspace';
  END IF;
  
  -- Set active workspace
  INSERT INTO user_preferences (user_id, active_workspace_id, updated_at)
  VALUES (ashmurak_user_id, ashmurak_workspace_id, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    active_workspace_id = ashmurak_workspace_id,
    updated_at = NOW();
    
  RAISE NOTICE 'Set ashmurak active workspace to: %', ashmurak_workspace_id;
END $$;

-- Step 2: Fix ALL stories - move to correct workspace
UPDATE stories s
SET workspace_id = COALESCE(
  -- First: workspace created by story owner
  (SELECT w.id
   FROM workspaces w
   WHERE w.created_by = s.user_id
   ORDER BY w.created_at
   LIMIT 1),
  -- Fallback: any workspace owner is a member of (prefer owner role)
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
AND (
  -- Fix stories where owner is not a member of workspace
  NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = s.workspace_id
    AND wm.user_id = s.user_id
  )
  OR
  -- Fix stories with NULL workspace_id
  s.workspace_id IS NULL
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

-- Step 3: VERIFICATION - Show what ashmurak will see
SELECT 
  '=== VERIFICATION: Stories in ashmurak workspace ===' as section;

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
    WHEN u.email = 'ashmurak@gmail.com' THEN '✅ CORRECT'
    ELSE '❌ WRONG - This should NOT be here!'
  END as status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
WHERE s.workspace_id = (SELECT id FROM ashmurak_workspace)
AND s.deleted_at IS NULL
ORDER BY s.created_at DESC;

-- Step 4: Show ashmurak's active workspace
SELECT 
  '=== ASHMURAK ACTIVE WORKSPACE ===' as section;

SELECT 
  u.email,
  up.active_workspace_id,
  w.name as active_workspace_name,
  w.created_by as workspace_owner_id,
  u2.email as workspace_owner_email,
  CASE 
    WHEN w.created_by = u.id THEN '✅ Own workspace'
    ELSE '❌ WRONG!'
  END as status
FROM auth.users u
LEFT JOIN user_preferences up ON up.user_id = u.id
LEFT JOIN workspaces w ON w.id = up.active_workspace_id
LEFT JOIN auth.users u2 ON u2.id = w.created_by
WHERE u.email = 'ashmurak@gmail.com';

COMMIT;

-- IMPORTANT: After running this SQL, ashmurak needs to:
-- 1. Close the app completely
-- 2. Clear app data/cache (or reinstall the app)
-- 3. Log back in
-- This will clear the cached active_workspace_id from AsyncStorage

