-- Complete Workspace Logo Storage Policies
-- These policies control access to the workspace_logos bucket
-- Apply via Supabase Dashboard: Storage → Policies → workspace_logos bucket
-- Or use Supabase CLI/Migration system with service role permissions

-- ============================================================================
-- 1. SELECT POLICY - Any workspace member can view logos
-- ============================================================================

-- Policy Name: workspace_logos_select_member
-- Operation: SELECT
-- Target Roles: authenticated

(
  bucket_id = 'workspace_logos' AND
  (storage.foldername(name))[1] = 'workspaces' AND
  EXISTS (
    SELECT 1 
    FROM workspace_members wm
    WHERE wm.workspace_id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
  )
)

-- ============================================================================
-- 2. INSERT POLICY - Owner only can upload logos
-- ============================================================================

-- Policy Name: workspace_logos_insert_owner
-- Operation: INSERT
-- Target Roles: authenticated
-- WITH CHECK expression:

(
  bucket_id = 'workspace_logos' AND
  (storage.foldername(name))[1] = 'workspaces' AND
  (storage.foldername(name))[3] = 'logo' AND
  EXISTS (
    SELECT 1 
    FROM workspace_members wm
    WHERE wm.workspace_id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
)

-- ============================================================================
-- 3. UPDATE POLICY - Owner only can update logos
-- ============================================================================

-- Policy Name: workspace_logos_update_owner
-- Operation: UPDATE
-- Target Roles: authenticated
-- USING expression (checks existing row):

(
  bucket_id = 'workspace_logos' AND
  (storage.foldername(name))[1] = 'workspaces' AND
  (storage.foldername(name))[3] = 'logo' AND
  EXISTS (
    SELECT 1 
    FROM workspace_members wm
    WHERE wm.workspace_id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
)

-- WITH CHECK expression (checks new row):

(
  bucket_id = 'workspace_logos' AND
  (storage.foldername(name))[1] = 'workspaces' AND
  (storage.foldername(name))[3] = 'logo' AND
  EXISTS (
    SELECT 1 
    FROM workspace_members wm
    WHERE wm.workspace_id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
)

-- ============================================================================
-- 4. DELETE POLICY - Owner only can delete logos
-- ============================================================================

-- Policy Name: workspace_logos_delete_owner
-- Operation: DELETE
-- Target Roles: authenticated
-- USING expression:

(
  bucket_id = 'workspace_logos' AND
  (storage.foldername(name))[1] = 'workspaces' AND
  (storage.foldername(name))[3] = 'logo' AND
  EXISTS (
    SELECT 1 
    FROM workspace_members wm
    WHERE wm.workspace_id::text = (storage.foldername(name))[2]
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
  )
)

-- ============================================================================
-- COMPLETE SQL FOR MIGRATION (if you have service role access)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "workspace_logos_select_member" ON storage.objects;
DROP POLICY IF EXISTS "workspace_logos_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "workspace_logos_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "workspace_logos_delete_owner" ON storage.objects;

-- SELECT: Any workspace member can view workspace logos
CREATE POLICY "workspace_logos_select_member"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    EXISTS (
      SELECT 1 
      FROM workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
    )
  );

-- INSERT: Owner only can upload workspace logos
CREATE POLICY "workspace_logos_insert_owner"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    (storage.foldername(name))[3] = 'logo' AND
    EXISTS (
      SELECT 1 
      FROM workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );

-- UPDATE: Owner only can update workspace logos
CREATE POLICY "workspace_logos_update_owner"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    (storage.foldername(name))[3] = 'logo' AND
    EXISTS (
      SELECT 1 
      FROM workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  )
  WITH CHECK (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    (storage.foldername(name))[3] = 'logo' AND
    EXISTS (
      SELECT 1 
      FROM workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );

-- DELETE: Owner only can delete workspace logos
CREATE POLICY "workspace_logos_delete_owner"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    (storage.foldername(name))[3] = 'logo' AND
    EXISTS (
      SELECT 1 
      FROM workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );

-- Add comments
COMMENT ON POLICY "workspace_logos_select_member" ON storage.objects IS 'Allow workspace members to view workspace logos';
COMMENT ON POLICY "workspace_logos_insert_owner" ON storage.objects IS 'Allow workspace owners to upload logos to their workspace';
COMMENT ON POLICY "workspace_logos_update_owner" ON storage.objects IS 'Allow workspace owners to update logos in their workspace';
COMMENT ON POLICY "workspace_logos_delete_owner" ON storage.objects IS 'Allow workspace owners to delete logos from their workspace';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Path Structure: workspaces/{workspace_id}/logo/{filename}
-- 
-- Policy Breakdown:
-- - SELECT: Any member of a workspace can view its logo
-- - INSERT: Only workspace owners can upload logos
-- - UPDATE: Only workspace owners can update/replace logos
-- - DELETE: Only workspace owners can delete logos
--
-- The policies use direct role checks instead of has_workspace_role() function
-- for better reliability in storage context.

