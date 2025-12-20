-- Fix stories workspace issue
-- Ensures stories are properly scoped to their creator's workspace
-- Adds validation trigger to prevent this issue in the future

-- Step 1: Fix stories that are in wrong workspaces
-- Update stories to belong to their owner's workspace
-- (prioritizing workspace created by owner, then any workspace they're a member of)
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

-- Step 2: Create validation function to prevent this in the future
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

-- Step 3: Create trigger to enforce validation
DROP TRIGGER IF EXISTS check_story_workspace_membership ON stories;

CREATE TRIGGER check_story_workspace_membership
  BEFORE INSERT OR UPDATE OF workspace_id, user_id ON stories
  FOR EACH ROW
  EXECUTE FUNCTION validate_story_workspace_membership();

COMMENT ON FUNCTION validate_story_workspace_membership IS 'Ensures story owner is a member of the workspace before allowing insert/update. Prevents stories from being created in workspaces where the owner is not a member.';

