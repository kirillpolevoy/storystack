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

