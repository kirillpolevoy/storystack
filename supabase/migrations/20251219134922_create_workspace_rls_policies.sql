-- StoryStack Workspaces v1 - RLS Policies
-- Creates comprehensive RLS policies for workspace-based access control

-- ============================================================================
-- 1. WORKSPACES POLICIES
-- ============================================================================

-- SELECT: Any workspace member can view workspace
DROP POLICY IF EXISTS "workspaces_select_member" ON workspaces;
CREATE POLICY "workspaces_select_member"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id));

-- UPDATE: Owner-only for name/logo, admin+ for other fields
-- Note: Field-level restrictions (name/logo vs status) should be enforced in application logic
-- RLS policies can only check role, not compare old vs new values
DROP POLICY IF EXISTS "workspaces_update_owner" ON workspaces;
CREATE POLICY "workspaces_update_owner"
  ON workspaces FOR UPDATE
  USING (has_workspace_role(id, 'owner'))
  WITH CHECK (has_workspace_role(id, 'owner'));

-- INSERT: Only authenticated users can create workspaces
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
CREATE POLICY "workspaces_insert_authenticated"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- ============================================================================
-- 2. WORKSPACE_MEMBERS POLICIES
-- ============================================================================

-- SELECT: Any member can view workspace members
DROP POLICY IF EXISTS "workspace_members_select_member" ON workspace_members;
CREATE POLICY "workspace_members_select_member"
  ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT: Admin+ can add members
DROP POLICY IF EXISTS "workspace_members_insert_admin" ON workspace_members;
CREATE POLICY "workspace_members_insert_admin"
  ON workspace_members FOR INSERT
  WITH CHECK (has_workspace_role(workspace_id, 'admin'));

-- UPDATE: Admin+ can change roles
-- Note: Restriction on changing owner role should be enforced in application logic
-- RLS policies cannot compare old vs new values
DROP POLICY IF EXISTS "workspace_members_update_admin" ON workspace_members;
CREATE POLICY "workspace_members_update_admin"
  ON workspace_members FOR UPDATE
  USING (has_workspace_role(workspace_id, 'admin'))
  WITH CHECK (has_workspace_role(workspace_id, 'admin'));

-- DELETE: Admin+ can remove members (but cannot remove owner unless owner)
DROP POLICY IF EXISTS "workspace_members_delete_admin" ON workspace_members;
CREATE POLICY "workspace_members_delete_admin"
  ON workspace_members FOR DELETE
  USING (
    has_workspace_role(workspace_id, 'admin') AND
    -- Only owner can remove owner
    (role != 'owner' OR has_workspace_role(workspace_id, 'owner'))
  );

-- ============================================================================
-- 3. ASSETS POLICIES
-- ============================================================================

-- Drop existing policies if they exist (user-based policies)
DROP POLICY IF EXISTS "Users can view their own assets" ON assets;
DROP POLICY IF EXISTS "Users can create their own assets" ON assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON assets;

-- SELECT: Any workspace member can view assets (including soft-deleted)
DROP POLICY IF EXISTS "assets_select_member" ON assets;
CREATE POLICY "assets_select_member"
  ON assets FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT: Editor+ can create assets
DROP POLICY IF EXISTS "assets_insert_editor" ON assets;
CREATE POLICY "assets_insert_editor"
  ON assets FOR INSERT
  WITH CHECK (
    has_workspace_role(workspace_id, 'editor') AND
    workspace_id IS NOT NULL
  );

-- UPDATE: Editor+ can update assets (including soft delete)
DROP POLICY IF EXISTS "assets_update_editor" ON assets;
CREATE POLICY "assets_update_editor"
  ON assets FOR UPDATE
  USING (has_workspace_role(workspace_id, 'editor'))
  WITH CHECK (has_workspace_role(workspace_id, 'editor'));

-- No DELETE policy - soft delete only via UPDATE

-- ============================================================================
-- 4. STORIES POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own stories" ON stories;
DROP POLICY IF EXISTS "Users can create their own stories" ON stories;
DROP POLICY IF EXISTS "Users can update their own stories" ON stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON stories;

-- SELECT: Any workspace member can view stories
DROP POLICY IF EXISTS "stories_select_member" ON stories;
CREATE POLICY "stories_select_member"
  ON stories FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT: Editor+ can create stories
DROP POLICY IF EXISTS "stories_insert_editor" ON stories;
CREATE POLICY "stories_insert_editor"
  ON stories FOR INSERT
  WITH CHECK (
    has_workspace_role(workspace_id, 'editor') AND
    workspace_id IS NOT NULL
  );

-- UPDATE: Editor+ can update stories (including soft delete)
DROP POLICY IF EXISTS "stories_update_editor" ON stories;
CREATE POLICY "stories_update_editor"
  ON stories FOR UPDATE
  USING (has_workspace_role(workspace_id, 'editor'))
  WITH CHECK (has_workspace_role(workspace_id, 'editor'));

-- No DELETE policy - soft delete only via UPDATE

-- ============================================================================
-- 5. TAGS POLICIES
-- ============================================================================

-- SELECT: Any workspace member can view tags
DROP POLICY IF EXISTS "tags_select_member" ON tags;
CREATE POLICY "tags_select_member"
  ON tags FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT: Editor+ can create tags
DROP POLICY IF EXISTS "tags_insert_editor" ON tags;
CREATE POLICY "tags_insert_editor"
  ON tags FOR INSERT
  WITH CHECK (
    has_workspace_role(workspace_id, 'editor') AND
    workspace_id IS NOT NULL
  );

-- UPDATE: Editor+ can update tags
DROP POLICY IF EXISTS "tags_update_editor" ON tags;
CREATE POLICY "tags_update_editor"
  ON tags FOR UPDATE
  USING (has_workspace_role(workspace_id, 'editor'))
  WITH CHECK (has_workspace_role(workspace_id, 'editor'));

-- DELETE: Editor+ can delete tags
DROP POLICY IF EXISTS "tags_delete_editor" ON tags;
CREATE POLICY "tags_delete_editor"
  ON tags FOR DELETE
  USING (has_workspace_role(workspace_id, 'editor'));

-- ============================================================================
-- 6. STORY_ASSETS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view story assets for their stories" ON story_assets;
DROP POLICY IF EXISTS "Users can add assets to their stories" ON story_assets;
DROP POLICY IF EXISTS "Users can update story assets in their stories" ON story_assets;
DROP POLICY IF EXISTS "Users can remove assets from their stories" ON story_assets;

-- SELECT: Any workspace member can view story_assets
DROP POLICY IF EXISTS "story_assets_select_member" ON story_assets;
CREATE POLICY "story_assets_select_member"
  ON story_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_assets.story_id
        AND is_workspace_member(s.workspace_id)
    )
  );

-- INSERT: Editor+ can add assets to stories (WITH CHECK ensures same workspace)
DROP POLICY IF EXISTS "story_assets_insert_editor" ON story_assets;
CREATE POLICY "story_assets_insert_editor"
  ON story_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_assets.story_id
        AND has_workspace_role(s.workspace_id, 'editor')
    )
    AND
    -- Integrity check: story and asset must be in same workspace
    EXISTS (
      SELECT 1 FROM stories s
      JOIN assets a ON a.id = story_assets.asset_id
      WHERE s.id = story_assets.story_id
        AND s.workspace_id = a.workspace_id
    )
  );

-- UPDATE: Editor+ can update story_assets (e.g., order_index)
DROP POLICY IF EXISTS "story_assets_update_editor" ON story_assets;
CREATE POLICY "story_assets_update_editor"
  ON story_assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_assets.story_id
        AND has_workspace_role(s.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_assets.story_id
        AND has_workspace_role(s.workspace_id, 'editor')
    )
  );

-- DELETE: Editor+ can remove assets from stories
DROP POLICY IF EXISTS "story_assets_delete_editor" ON story_assets;
CREATE POLICY "story_assets_delete_editor"
  ON story_assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_assets.story_id
        AND has_workspace_role(s.workspace_id, 'editor')
    )
  );

-- ============================================================================
-- 7. ASSET_TAGS POLICIES
-- ============================================================================

-- SELECT: Any workspace member can view asset_tags
DROP POLICY IF EXISTS "asset_tags_select_member" ON asset_tags;
CREATE POLICY "asset_tags_select_member"
  ON asset_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_tags.asset_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- INSERT: Editor+ can add tags to assets (WITH CHECK ensures same workspace)
DROP POLICY IF EXISTS "asset_tags_insert_editor" ON asset_tags;
CREATE POLICY "asset_tags_insert_editor"
  ON asset_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_tags.asset_id
        AND has_workspace_role(a.workspace_id, 'editor')
    )
    AND
    -- Integrity check: asset and tag must be in same workspace
    EXISTS (
      SELECT 1 FROM assets a
      JOIN tags t ON t.id = asset_tags.tag_id
      WHERE a.id = asset_tags.asset_id
        AND a.workspace_id = t.workspace_id
    )
  );

-- DELETE: Editor+ can remove tags from assets
DROP POLICY IF EXISTS "asset_tags_delete_editor" ON asset_tags;
CREATE POLICY "asset_tags_delete_editor"
  ON asset_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_tags.asset_id
        AND has_workspace_role(a.workspace_id, 'editor')
    )
  );

-- ============================================================================
-- 8. AUDIT_LOG POLICIES
-- ============================================================================

-- SELECT: Any workspace member can view audit log
DROP POLICY IF EXISTS "audit_log_select_member" ON audit_log;
CREATE POLICY "audit_log_select_member"
  ON audit_log FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT: Only triggers/service role can insert (no policy needed, handled by triggers)

-- ============================================================================
-- 9. TAG_CONFIG POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own tag_config" ON tag_config;
DROP POLICY IF EXISTS "Users can create their own tag_config" ON tag_config;
DROP POLICY IF EXISTS "Users can update their own tag_config" ON tag_config;
DROP POLICY IF EXISTS "Users can delete their own tag_config" ON tag_config;

-- SELECT: Any workspace member can view tag_config
DROP POLICY IF EXISTS "tag_config_select_member" ON tag_config;
CREATE POLICY "tag_config_select_member"
  ON tag_config FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT: Editor+ can create tag_config
DROP POLICY IF EXISTS "tag_config_insert_editor" ON tag_config;
CREATE POLICY "tag_config_insert_editor"
  ON tag_config FOR INSERT
  WITH CHECK (
    has_workspace_role(workspace_id, 'editor') AND
    workspace_id IS NOT NULL
  );

-- UPDATE: Editor+ can update tag_config
DROP POLICY IF EXISTS "tag_config_update_editor" ON tag_config;
CREATE POLICY "tag_config_update_editor"
  ON tag_config FOR UPDATE
  USING (has_workspace_role(workspace_id, 'editor'))
  WITH CHECK (has_workspace_role(workspace_id, 'editor'));

-- DELETE: Editor+ can delete tag_config
DROP POLICY IF EXISTS "tag_config_delete_editor" ON tag_config;
CREATE POLICY "tag_config_delete_editor"
  ON tag_config FOR DELETE
  USING (has_workspace_role(workspace_id, 'editor'));

-- ============================================================================
-- 10. USER_PREFERENCES POLICIES
-- ============================================================================

-- SELECT: Users can view their own preferences
DROP POLICY IF EXISTS "user_preferences_select_own" ON user_preferences;
CREATE POLICY "user_preferences_select_own"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create their own preferences
DROP POLICY IF EXISTS "user_preferences_insert_own" ON user_preferences;
CREATE POLICY "user_preferences_insert_own"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own preferences
DROP POLICY IF EXISTS "user_preferences_update_own" ON user_preferences;
CREATE POLICY "user_preferences_update_own"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    -- Ensure active_workspace_id is a workspace they belong to
    (
      active_workspace_id IS NULL OR
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = active_workspace_id
          AND wm.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 11. CAMPAIGNS POLICIES (keep existing for now, will be removed later)
-- ============================================================================

-- Note: Campaigns will be removed, but keeping policies for now to avoid breaking existing code
-- These will be dropped when campaigns are fully removed



