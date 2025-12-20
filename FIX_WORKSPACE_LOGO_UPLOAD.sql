-- Fix workspace logo upload RLS policy issue
-- 
-- IMPORTANT: Storage policies require special permissions and cannot be modified
-- via regular SQL editor. You must use one of these methods:
--
-- Option 1 (Recommended): Use Supabase Dashboard
--   1. Go to Storage → Policies → workspace_logos bucket
--   2. Edit the policies manually using the expressions below
--   3. See FIX_WORKSPACE_LOGO_UPLOAD_GUIDE.md for detailed instructions
--
-- Option 2: Use Supabase CLI with service role
--   supabase db reset (if running locally)
--   Or apply via migration system if you have service role access
--
-- Option 3: Use Management API with service role key
--   See Supabase documentation for Storage API policy management
--
-- The SQL below shows what the policies should be, but you need to apply them
-- via Dashboard or with service role permissions.

-- Fix workspace_logos storage INSERT policy
-- The policy was using has_workspace_role() which might not work correctly in storage context
-- Use direct role check instead for better reliability

DROP POLICY IF EXISTS "workspace_logos_insert_owner" ON storage.objects;

CREATE POLICY "workspace_logos_insert_owner"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace_logos' AND
    -- Match path structure: workspaces/{workspace_id}/logo/{filename}
    (storage.foldername(name))[1] = 'workspaces' AND
    (storage.foldername(name))[3] = 'logo' AND
    -- Verify user is owner of the workspace (direct check, not using function)
    EXISTS (
      SELECT 1 
      FROM workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[2]
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );

-- Also update the UPDATE policy to be consistent
DROP POLICY IF EXISTS "workspace_logos_update_owner" ON storage.objects;

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

COMMENT ON POLICY "workspace_logos_insert_owner" ON storage.objects IS 'Allow workspace owners to upload logos to their workspace';
COMMENT ON POLICY "workspace_logos_update_owner" ON storage.objects IS 'Allow workspace owners to update logos in their workspace';

