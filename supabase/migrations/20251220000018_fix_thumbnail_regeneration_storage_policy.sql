-- Fix storage policies to allow thumbnail regeneration
-- The UPDATE policy needs to handle subdirectories like thumb/ and preview/

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "assets_update_editor" ON storage.objects;

-- UPDATE: Editor+ can update assets (including thumbnails in subdirectories)
-- Path formats:
-- - workspaces/{workspace_id}/assets/{asset_id}/{filename}
-- - workspaces/{workspace_id}/assets/{asset_id}/thumb/{filename}
-- - workspaces/{workspace_id}/assets/{asset_id}/preview/{filename}
CREATE POLICY "assets_update_editor"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'assets' AND
    (
      -- New workspace path format (handles root and subdirectories)
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
    (
      -- New workspace path format (handles root and subdirectories)
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
          WHERE a.storage_path = name OR a.storage_path_thumb = name OR a.storage_path_preview = name
            AND has_workspace_role(a.workspace_id, 'editor')
        )
      )
    )
  );

-- Also ensure INSERT policy allows upsert operations for thumbnails
-- When using upsert: true, Supabase may try INSERT first, so we need INSERT permission too
-- The existing INSERT policy should already handle this, but let's verify it works for subdirectories

