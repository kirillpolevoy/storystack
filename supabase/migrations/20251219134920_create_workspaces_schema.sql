-- StoryStack Workspaces v1 - Main Schema Migration
-- Creates workspace tables, modifies existing tables, and adds helper functions

-- ============================================================================
-- 1. CREATE NEW TABLES
-- ============================================================================

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_path TEXT NULL,
  logo_updated_at TIMESTAMPTZ NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted'))
);

-- Workspace members table
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (workspace_id, user_id)
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  diff JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tags table (normalized from assets.tags array)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index for case-insensitive tag names per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_workspace_id_lower_name 
ON tags(workspace_id, LOWER(name));

-- Asset tags join table
CREATE TABLE IF NOT EXISTS asset_tags (
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_id, tag_id)
);

-- User preferences table (for active workspace sync across devices)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. MODIFY EXISTING TABLES
-- ============================================================================

-- Add workspace_id to assets (nullable initially, will be set NOT NULL after migration)
ALTER TABLE assets 
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE RESTRICT;

-- Add workspace_id to stories (nullable initially)
ALTER TABLE stories 
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE RESTRICT;

-- Add soft delete columns to assets
ALTER TABLE assets 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Add soft delete columns to stories
ALTER TABLE stories 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Add added_by and added_at to story_assets if not present
ALTER TABLE story_assets 
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT NOW();

-- Modify tag_config: change user_id to workspace_id
-- First, add workspace_id column
ALTER TABLE tag_config 
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Note: We'll migrate the data in the migration script, then drop user_id column

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Workspaces indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status) WHERE status = 'active';

-- Workspace members indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(workspace_id, role);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_id ON audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(workspace_id, entity_type, entity_id);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON tags(workspace_id);
-- Note: Unique index idx_tags_workspace_id_lower_name created above handles uniqueness constraint

-- Asset tags indexes
CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON asset_tags(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id ON asset_tags(tag_id);

-- Assets indexes (workspace and soft delete)
CREATE INDEX IF NOT EXISTS idx_assets_workspace_id_created_at ON assets(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_workspace_id_not_deleted ON assets(workspace_id) WHERE deleted_at IS NULL;

-- Stories indexes (workspace)
CREATE INDEX IF NOT EXISTS idx_stories_workspace_id_updated_at ON stories(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_workspace_id_not_deleted ON stories(workspace_id) WHERE deleted_at IS NULL;

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_active_workspace ON user_preferences(active_workspace_id);

-- ============================================================================
-- 4. CREATE SQL HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Function to check if current user is a member of a workspace
CREATE OR REPLACE FUNCTION is_workspace_member(wid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM workspace_members 
    WHERE workspace_id = wid 
      AND user_id = auth.uid()
  );
$$;

-- Function to get current user's role in a workspace
CREATE OR REPLACE FUNCTION workspace_role(wid UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role 
  FROM workspace_members 
  WHERE workspace_id = wid 
    AND user_id = auth.uid()
  LIMIT 1;
$$;

-- Function to check if current user has minimum required role
-- Role hierarchy: owner > admin > editor > viewer
CREATE OR REPLACE FUNCTION has_workspace_role(wid UUID, min_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
  role_hierarchy JSONB := '{"owner": 4, "admin": 3, "editor": 2, "viewer": 1}'::JSONB;
  user_level INT;
  min_level INT;
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM workspace_members
  WHERE workspace_id = wid 
    AND user_id = auth.uid()
  LIMIT 1;
  
  -- If not a member, return false
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get role levels
  user_level := (role_hierarchy->>user_role)::INT;
  min_level := (role_hierarchy->>min_role)::INT;
  
  -- Check if user's level is >= minimum required
  RETURN user_level >= min_level;
END;
$$;

-- ============================================================================
-- 5. CREATE INTEGRITY TRIGGERS
-- ============================================================================

-- Function to ensure story_assets only links assets/stories in same workspace
CREATE OR REPLACE FUNCTION check_story_asset_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  story_workspace_id UUID;
  asset_workspace_id UUID;
BEGIN
  -- Get workspace_id from story
  SELECT workspace_id INTO story_workspace_id
  FROM stories
  WHERE id = NEW.story_id;
  
  -- Get workspace_id from asset
  SELECT workspace_id INTO asset_workspace_id
  FROM assets
  WHERE id = NEW.asset_id;
  
  -- Ensure they match
  IF story_workspace_id IS NULL OR asset_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Story or asset must have a workspace_id';
  END IF;
  
  IF story_workspace_id != asset_workspace_id THEN
    RAISE EXCEPTION 'Story and asset must belong to the same workspace';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for story_assets INSERT/UPDATE
CREATE TRIGGER trigger_check_story_asset_workspace
  BEFORE INSERT OR UPDATE ON story_assets
  FOR EACH ROW
  EXECUTE FUNCTION check_story_asset_workspace();

-- Function to ensure asset_tags only links assets/tags in same workspace
CREATE OR REPLACE FUNCTION check_asset_tag_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  asset_workspace_id UUID;
  tag_workspace_id UUID;
BEGIN
  -- Get workspace_id from asset
  SELECT workspace_id INTO asset_workspace_id
  FROM assets
  WHERE id = NEW.asset_id;
  
  -- Get workspace_id from tag
  SELECT workspace_id INTO tag_workspace_id
  FROM tags
  WHERE id = NEW.tag_id;
  
  -- Ensure they match
  IF asset_workspace_id IS NULL OR tag_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Asset or tag must have a workspace_id';
  END IF;
  
  IF asset_workspace_id != tag_workspace_id THEN
    RAISE EXCEPTION 'Asset and tag must belong to the same workspace';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for asset_tags INSERT/UPDATE
CREATE TRIGGER trigger_check_asset_tag_workspace
  BEFORE INSERT OR UPDATE ON asset_tags
  FOR EACH ROW
  EXECUTE FUNCTION check_asset_tag_workspace();

-- ============================================================================
-- 6. ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. CREATE UPDATED_AT TRIGGER FUNCTION (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at trigger to workspaces
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger to tags
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger to user_preferences
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE workspaces IS 'Top-level container for collaboration and workspace branding';
COMMENT ON TABLE workspace_members IS 'Many-to-many relationship between users and workspaces with roles';
COMMENT ON TABLE audit_log IS 'Audit trail for workspace actions';
COMMENT ON TABLE tags IS 'Normalized tags table, workspace-scoped';
COMMENT ON TABLE asset_tags IS 'Many-to-many relationship between assets and tags';
COMMENT ON TABLE user_preferences IS 'User preferences including active workspace for cross-device sync';

COMMENT ON FUNCTION is_workspace_member IS 'Check if current user is a member of the specified workspace';
COMMENT ON FUNCTION workspace_role IS 'Get current user''s role in the specified workspace';
COMMENT ON FUNCTION has_workspace_role IS 'Check if current user has minimum required role in workspace (owner > admin > editor > viewer)';

