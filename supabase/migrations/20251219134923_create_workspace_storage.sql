-- StoryStack Workspaces v1 - Storage Setup
-- Creates workspace_logos bucket and sets up storage RLS policies

-- ============================================================================
-- 1. CREATE WORKSPACE_LOGOS STORAGE BUCKET
-- ============================================================================

-- Create bucket if it doesn't exist (requires superuser or service role)
-- Note: This may require running with service_role permissions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace_logos',
  'workspace_logos',
  true, -- Public bucket (logos need to be accessible)
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. STORAGE RLS POLICIES FOR ASSETS BUCKET
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "assets_select_member" ON storage.objects;
DROP POLICY IF EXISTS "assets_insert_editor" ON storage.objects;
DROP POLICY IF EXISTS "assets_update_editor" ON storage.objects;
DROP POLICY IF EXISTS "assets_delete_editor" ON storage.objects;

-- SELECT: Any workspace member can read assets
-- Path format: workspaces/{workspace_id}/assets/{asset_id}/{filename}
CREATE POLICY "assets_select_member"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assets' AND
    (
      -- New workspace path format
      (
        (storage.foldername(name))[1] = 'workspaces' AND
        EXISTS (
          SELECT 1 FROM workspaces w
          JOIN workspace_members wm ON wm.workspace_id = w.id
          WHERE w.id::text = (storage.foldername(name))[2]
            AND wm.user_id = auth.uid()
        )
      )
      OR
      -- Legacy path format (for backward compatibility during migration)
      (
        (storage.foldername(name))[1] = 'users' AND
        EXISTS (
          SELECT 1 FROM assets a
          WHERE a.storage_path = name
            AND is_workspace_member(a.workspace_id)
        )
      )
    )
  );

-- INSERT: Editor+ can upload assets
CREATE POLICY "assets_insert_editor"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assets' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND has_workspace_role(w.id, 'editor')
    )
  );

-- UPDATE: Editor+ can update assets
CREATE POLICY "assets_update_editor"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'assets' AND
    (
      -- New workspace path format
      (
        (storage.foldername(name))[1] = 'workspaces' AND
        EXISTS (
          SELECT 1 FROM workspaces w
          JOIN workspace_members wm ON wm.workspace_id = w.id
          WHERE w.id::text = (storage.foldername(name))[2]
            AND wm.user_id = auth.uid()
            AND has_workspace_role(w.id, 'editor')
        )
      )
      OR
      -- Legacy path format
      (
        (storage.foldername(name))[1] = 'users' AND
        EXISTS (
          SELECT 1 FROM assets a
          WHERE a.storage_path = name
            AND has_workspace_role(a.workspace_id, 'editor')
        )
      )
    )
  )
  WITH CHECK (
    bucket_id = 'assets' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND has_workspace_role(w.id, 'editor')
    )
  );

-- DELETE: Editor+ can delete assets
CREATE POLICY "assets_delete_editor"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assets' AND
    (
      -- New workspace path format
      (
        (storage.foldername(name))[1] = 'workspaces' AND
        EXISTS (
          SELECT 1 FROM workspaces w
          JOIN workspace_members wm ON wm.workspace_id = w.id
          WHERE w.id::text = (storage.foldername(name))[2]
            AND wm.user_id = auth.uid()
            AND has_workspace_role(w.id, 'editor')
        )
      )
      OR
      -- Legacy path format
      (
        (storage.foldername(name))[1] = 'users' AND
        EXISTS (
          SELECT 1 FROM assets a
          WHERE a.storage_path = name
            AND has_workspace_role(a.workspace_id, 'editor')
        )
      )
    )
  );

-- ============================================================================
-- 3. STORAGE RLS POLICIES FOR WORKSPACE_LOGOS BUCKET
-- ============================================================================

-- SELECT: Any workspace member can view workspace logos
DROP POLICY IF EXISTS "workspace_logos_select_member" ON storage.objects;
CREATE POLICY "workspace_logos_select_member"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
    )
  );

-- INSERT: Owner only can upload workspace logos
DROP POLICY IF EXISTS "workspace_logos_insert_owner" ON storage.objects;
CREATE POLICY "workspace_logos_insert_owner"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    (storage.foldername(name))[3] = 'logo' AND
    EXISTS (
      SELECT 1 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND has_workspace_role(w.id, 'owner')
    )
  );

-- UPDATE: Owner only can update workspace logos
DROP POLICY IF EXISTS "workspace_logos_update_owner" ON storage.objects;
CREATE POLICY "workspace_logos_update_owner"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND has_workspace_role(w.id, 'owner')
    )
  )
  WITH CHECK (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND has_workspace_role(w.id, 'owner')
    )
  );

-- DELETE: Owner only can delete workspace logos
DROP POLICY IF EXISTS "workspace_logos_delete_owner" ON storage.objects;
CREATE POLICY "workspace_logos_delete_owner"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace_logos' AND
    (storage.foldername(name))[1] = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND has_workspace_role(w.id, 'owner')
    )
  );

-- ============================================================================
-- NOTES
-- ============================================================================

-- Storage bucket creation must be done via Supabase Dashboard or Management API
-- The workspace_logos bucket should be configured with:
-- - Public: false (private bucket)
-- - File size limit: 5MB
-- - Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp
--
-- Path conventions:
-- - Assets: workspaces/{workspace_id}/assets/{asset_id}/{filename}
-- - Logos: workspaces/{workspace_id}/logo/{uuid}.{ext}
--
-- Legacy paths (users/{user_id}/...) are supported during migration period
-- but new uploads must use workspace paths



