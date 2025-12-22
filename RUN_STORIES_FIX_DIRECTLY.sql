-- Run this directly in Supabase SQL Editor to fix stories workspace issue
-- This is the same as migration 20251220000005_fix_stories_workspace_issue.sql

-- Step 1: Fix stories that are in wrong workspaces
UPDATE stories s
SET workspace_id = COALESCE(
  -- First try: workspace created by story owner
  (SELECT w.id
   FROM workspaces w
   WHERE w.created_by = s.user_id
   ORDER BY w.created_at
   LIMIT 1),
  -- Fallback: any workspace story owner is a member of
  (SELECT wm.workspace_id
   FROM workspace_members wm
   WHERE wm.user_id = s.user_id
   ORDER BY wm.created_at
   LIMIT 1)
)
WHERE s.deleted_at IS NULL
AND s.workspace_id IS DISTINCT FROM COALESCE(
  (SELECT w.id
   FROM workspaces w
   WHERE w.created_by = s.user_id
   ORDER BY w.created_at
   LIMIT 1),
  (SELECT wm.workspace_id
   FROM workspace_members wm
   WHERE wm.user_id = s.user_id
   ORDER BY wm.created_at
   LIMIT 1)
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
   ORDER BY wm.created_at
   LIMIT 1)
) IS NOT NULL;

-- Step 2: Create validation function
CREATE OR REPLACE FUNCTION validate_story_workspace_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation if workspace_id is NULL (will be handled by NOT NULL constraint or application logic)
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if the story owner is a member of the workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = NEW.workspace_id
    AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Story owner must be a member of the workspace. User % is not a member of workspace %', 
      NEW.user_id, NEW.workspace_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger
DROP TRIGGER IF EXISTS check_story_workspace_membership ON stories;

CREATE TRIGGER check_story_workspace_membership
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON stories
  FOR EACH ROW
  EXECUTE FUNCTION validate_story_workspace_membership();

COMMENT ON FUNCTION validate_story_workspace_membership IS 'Ensures story owner is a member of the workspace before allowing insert/update. Prevents stories from being created in workspaces where the owner is not a member.';

-- Verification query
SELECT 
  s.id as story_id,
  s.name as story_name,
  u.email as story_owner_email,
  s.workspace_id,
  w.name as workspace_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = s.workspace_id
      AND wm.user_id = s.user_id
    ) THEN '✅ OK'
    ELSE '❌ Still has issue'
  END as verification_status
FROM stories s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.deleted_at IS NULL
AND u.email IN ('kpolevoy@gmail.com', 'ashmurak@gmail.com')
ORDER BY u.email, s.created_at DESC;

