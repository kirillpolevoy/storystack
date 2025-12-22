-- Fix stories workspace issue
-- Ensure stories are properly scoped to their creator's workspace

-- Step 1: Identify stories that might be in wrong workspaces
-- Stories should belong to the workspace of the user who created them
-- (unless they were explicitly moved, which we don't support yet)

-- Check for stories where the creator is not a member of the story's workspace
WITH story_workspace_issues AS (
  SELECT 
    s.id as story_id,
    s.name as story_name,
    s.user_id as story_owner_id,
    u.email as story_owner_email,
    s.workspace_id as current_workspace_id,
    w.name as current_workspace_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = s.workspace_id
        AND wm.user_id = s.user_id
      ) THEN 'OK - Owner is member'
      ELSE 'ISSUE - Owner not a member!'
    END as status
  FROM stories s
  JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN workspaces w ON w.id = s.workspace_id
  WHERE s.deleted_at IS NULL
)
SELECT * FROM story_workspace_issues
WHERE status LIKE 'ISSUE%'
ORDER BY story_owner_email;

-- Step 2: Find the correct workspace for each story
-- Stories should belong to the workspace created by the story owner
-- (or the workspace they're a member of, prioritizing their own workspace)
WITH story_correct_workspace AS (
  SELECT 
    s.id as story_id,
    s.user_id as story_owner_id,
    s.workspace_id as current_workspace_id,
    -- Find the story owner's default workspace (workspace they created)
    (
      SELECT w.id
      FROM workspaces w
      WHERE w.created_by = s.user_id
      ORDER BY w.created_at
      LIMIT 1
    ) as owner_workspace_id,
    -- Or find any workspace they're a member of
    (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = s.user_id
      ORDER BY wm.created_at
      LIMIT 1
    ) as member_workspace_id
  FROM stories s
  WHERE s.deleted_at IS NULL
)
SELECT 
  story_id,
  current_workspace_id,
  COALESCE(owner_workspace_id, member_workspace_id) as correct_workspace_id,
  CASE 
    WHEN current_workspace_id = COALESCE(owner_workspace_id, member_workspace_id) THEN 'OK'
    ELSE 'NEEDS FIX'
  END as status
FROM story_correct_workspace
WHERE COALESCE(owner_workspace_id, member_workspace_id) IS NOT NULL
ORDER BY status DESC;

-- Step 3: Fix stories that are in wrong workspaces
-- Update stories to belong to their owner's workspace
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

-- Step 4: Verify the fix
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

-- Step 5: Add a constraint to prevent this in the future
-- Ensure stories can only be created if the user is a member of the workspace
-- (This should already be enforced by RLS, but let's add a check constraint)

-- Note: We can't add a CHECK constraint that queries another table in PostgreSQL
-- Instead, we'll rely on RLS policies and application-level validation
-- But we can add a trigger to validate on insert/update

CREATE OR REPLACE FUNCTION validate_story_workspace_membership()
RETURNS TRIGGER AS $$
BEGIN
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

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS check_story_workspace_membership ON stories;

-- Create trigger
CREATE TRIGGER check_story_workspace_membership
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON stories
  FOR EACH ROW
  EXECUTE FUNCTION validate_story_workspace_membership();

COMMENT ON FUNCTION validate_story_workspace_membership IS 'Ensures story owner is a member of the workspace before allowing insert/update';

