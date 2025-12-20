-- StoryStack Workspaces v1 - Migrate Existing Users
-- Creates default workspaces for existing users and backfills workspace_id

-- ============================================================================
-- STEP 1: CREATE DEFAULT WORKSPACE FOR EACH EXISTING USER
-- ============================================================================

-- Create workspaces for users who have assets, stories, or tag_config
-- but don't have a workspace yet
DO $$
DECLARE
  user_record RECORD;
  workspace_id_val UUID;
  workspace_name TEXT;
BEGIN
  -- Loop through users who have data but no workspace
  FOR user_record IN 
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    WHERE EXISTS (
      SELECT 1 FROM assets WHERE user_id = u.id
    ) OR EXISTS (
      SELECT 1 FROM stories WHERE user_id = u.id
    ) OR EXISTS (
      SELECT 1 FROM tag_config WHERE user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members wm WHERE wm.user_id = u.id
    )
  LOOP
    -- Generate workspace name from email or use default
    workspace_name := COALESCE(
      INITCAP(SPLIT_PART(user_record.email, '@', 1)),
      'My Workspace'
    );
    
    -- Create workspace
    INSERT INTO workspaces (name, created_by, status)
    VALUES (workspace_name, user_record.id, 'active')
    RETURNING id INTO workspace_id_val;
    
    -- Add user as owner
    INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
    VALUES (workspace_id_val, user_record.id, 'owner', user_record.id);
    
    RAISE NOTICE 'Created workspace "%" for user %', workspace_name, user_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: BACKFILL workspace_id FOR ASSETS
-- ============================================================================

-- Update assets.workspace_id to user's default workspace
UPDATE assets a
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = a.user_id
    AND wm.role = 'owner'
  LIMIT 1
)
WHERE a.workspace_id IS NULL
  AND a.user_id IS NOT NULL;

-- ============================================================================
-- STEP 3: BACKFILL workspace_id FOR STORIES
-- ============================================================================

-- Update stories.workspace_id to user's default workspace
UPDATE stories s
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = s.user_id
    AND wm.role = 'owner'
  LIMIT 1
)
WHERE s.workspace_id IS NULL
  AND s.user_id IS NOT NULL;

-- ============================================================================
-- STEP 4: MIGRATE TAGS FROM ARRAY TO NORMALIZED TABLE
-- ============================================================================

-- Extract unique tags from assets.tags array and create tags in workspace
DO $$
DECLARE
  asset_record RECORD;
  tag_name TEXT;
  tag_id_val UUID;
  workspace_id_val UUID;
BEGIN
  -- Loop through assets that have tags array
  FOR asset_record IN 
    SELECT DISTINCT a.id, a.workspace_id, a.tags
    FROM assets a
    WHERE a.workspace_id IS NOT NULL
      AND a.tags IS NOT NULL
      AND array_length(a.tags, 1) > 0
  LOOP
    workspace_id_val := asset_record.workspace_id;
    
    -- Loop through each tag in the array
    FOREACH tag_name IN ARRAY asset_record.tags
    LOOP
      -- Skip empty tags
      IF tag_name IS NULL OR TRIM(tag_name) = '' THEN
        CONTINUE;
      END IF;
      
      -- Get or create tag
      SELECT id INTO tag_id_val
      FROM tags
      WHERE workspace_id = workspace_id_val
        AND LOWER(name) = LOWER(TRIM(tag_name))
      LIMIT 1;
      
      -- Create tag if it doesn't exist
      IF tag_id_val IS NULL THEN
        INSERT INTO tags (workspace_id, name)
        VALUES (workspace_id_val, TRIM(tag_name))
        RETURNING id INTO tag_id_val;
      END IF;
      
      -- Link asset to tag (ignore if already exists)
      INSERT INTO asset_tags (asset_id, tag_id)
      VALUES (asset_record.id, tag_id_val)
      ON CONFLICT (asset_id, tag_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: MIGRATE tag_config FROM user_id TO workspace_id
-- ============================================================================

-- Update tag_config.workspace_id from user's default workspace
UPDATE tag_config tc
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = tc.user_id
    AND wm.role = 'owner'
  LIMIT 1
)
WHERE tc.workspace_id IS NULL
  AND tc.user_id IS NOT NULL;

-- Handle duplicate tag_configs per workspace (keep the first one)
-- If multiple users had tag_configs, we'll merge them or keep the first
DO $$
DECLARE
  config_record RECORD;
  workspace_id_val UUID;
  first_config_id UUID;
BEGIN
  -- Find workspaces with multiple tag_configs
  FOR workspace_id_val IN
    SELECT DISTINCT workspace_id
    FROM tag_config
    WHERE workspace_id IS NOT NULL
    GROUP BY workspace_id
    HAVING COUNT(*) > 1
  LOOP
    -- Get the first config (oldest)
    SELECT id INTO first_config_id
    FROM tag_config
    WHERE workspace_id = workspace_id_val
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Merge auto_tags, custom_tags, deleted_tags from all configs
    UPDATE tag_config
    SET 
      auto_tags = (
        SELECT ARRAY_AGG(DISTINCT tag)
        FROM (
          SELECT UNNEST(COALESCE(auto_tags, ARRAY[]::TEXT[])) AS tag
          FROM tag_config
          WHERE workspace_id = workspace_id_val
        ) t
        WHERE tag IS NOT NULL
      ),
      custom_tags = (
        SELECT ARRAY_AGG(DISTINCT tag)
        FROM (
          SELECT UNNEST(COALESCE(custom_tags, ARRAY[]::TEXT[])) AS tag
          FROM tag_config
          WHERE workspace_id = workspace_id_val
        ) t
        WHERE tag IS NOT NULL
      ),
      deleted_tags = (
        SELECT ARRAY_AGG(DISTINCT tag)
        FROM (
          SELECT UNNEST(COALESCE(deleted_tags, ARRAY[]::TEXT[])) AS tag
          FROM tag_config
          WHERE workspace_id = workspace_id_val
        ) t
        WHERE tag IS NOT NULL
      )
    WHERE id = first_config_id;
    
    -- Delete duplicate configs
    DELETE FROM tag_config
    WHERE workspace_id = workspace_id_val
      AND id != first_config_id;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 6: SET workspace_id NOT NULL AND ADD CONSTRAINTS
-- ============================================================================

-- First, ensure all assets have workspace_id (set to a default if somehow missing)
UPDATE assets
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = assets.user_id
  LIMIT 1
)
WHERE workspace_id IS NULL
  AND user_id IS NOT NULL;

-- Set workspace_id NOT NULL on assets
ALTER TABLE assets 
  ALTER COLUMN workspace_id SET NOT NULL;

-- Ensure all stories have workspace_id
UPDATE stories
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = stories.user_id
  LIMIT 1
)
WHERE workspace_id IS NULL
  AND user_id IS NOT NULL;

-- Set workspace_id NOT NULL on stories
ALTER TABLE stories 
  ALTER COLUMN workspace_id SET NOT NULL;

-- Ensure all tags have workspace_id (should already be set)
ALTER TABLE tags 
  ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================================================
-- STEP 7: REMOVE campaign_id FROM ASSETS (campaigns are removed)
-- ============================================================================

-- Drop foreign key constraint if exists
ALTER TABLE assets 
  DROP CONSTRAINT IF EXISTS assets_campaign_id_fkey;

-- Drop the column
ALTER TABLE assets 
  DROP COLUMN IF EXISTS campaign_id;

-- ============================================================================
-- STEP 8: REMOVE user_id FROM tag_config (now workspace-scoped)
-- ============================================================================

-- First, drop existing RLS policies that depend on user_id
-- (These will be recreated with workspace-scoped policies in the next migration)
DROP POLICY IF EXISTS "Users can only see their own tag config" ON tag_config;
DROP POLICY IF EXISTS "Users can only insert their own tag config" ON tag_config;
DROP POLICY IF EXISTS "Users can only update their own tag config" ON tag_config;
DROP POLICY IF EXISTS "Users can only delete their own tag config" ON tag_config;
DROP POLICY IF EXISTS "Users can view their own tag_config" ON tag_config;
DROP POLICY IF EXISTS "Users can create their own tag_config" ON tag_config;
DROP POLICY IF EXISTS "Users can update their own tag_config" ON tag_config;
DROP POLICY IF EXISTS "Users can delete their own tag_config" ON tag_config;

-- Drop foreign key constraint if exists
ALTER TABLE tag_config 
  DROP CONSTRAINT IF EXISTS tag_config_user_id_fkey;

-- Drop the column (after migration is complete)
-- Note: New workspace-scoped policies will be created in the next migration
ALTER TABLE tag_config 
  DROP COLUMN IF EXISTS user_id;

-- Set workspace_id NOT NULL on tag_config
ALTER TABLE tag_config 
  ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================================================
-- STEP 9: CREATE UNIQUE CONSTRAINT ON tag_config.workspace_id
-- ============================================================================

-- Ensure one tag_config per workspace
ALTER TABLE tag_config 
  ADD CONSTRAINT tag_config_workspace_id_unique UNIQUE (workspace_id);

-- ============================================================================
-- STEP 10: UPDATE story_assets.added_at FOR EXISTING RECORDS
-- ============================================================================

-- Set added_at to created_at for existing records
UPDATE story_assets
SET added_at = created_at
WHERE added_at IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- ============================================================================

-- Verify all assets have workspace_id
-- SELECT COUNT(*) as assets_without_workspace FROM assets WHERE workspace_id IS NULL;

-- Verify all stories have workspace_id
-- SELECT COUNT(*) as stories_without_workspace FROM stories WHERE workspace_id IS NULL;

-- Verify all users with data have workspaces
-- SELECT COUNT(DISTINCT user_id) as users_with_data FROM (
--   SELECT user_id FROM assets
--   UNION
--   SELECT user_id FROM stories
--   UNION
--   SELECT user_id FROM tag_config WHERE user_id IS NOT NULL
-- ) u
-- WHERE NOT EXISTS (
--   SELECT 1 FROM workspace_members wm WHERE wm.user_id = u.user_id
-- );

-- Verify tag migration
-- SELECT 
--   COUNT(DISTINCT a.id) as assets_with_tags,
--   COUNT(DISTINCT t.id) as total_tags,
--   COUNT(DISTINCT at.asset_id) as assets_with_normalized_tags
-- FROM assets a
-- LEFT JOIN asset_tags at ON at.asset_id = a.id
-- LEFT JOIN tags t ON t.id = at.tag_id;



