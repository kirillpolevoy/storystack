-- Fix INSERT policy to allow upserting thumbnails in subdirectories
-- When using upsert: true, Supabase may try INSERT first if the object doesn't exist
-- We need to ensure INSERT policy allows thumb/ and preview/ subdirectories

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "assets_insert_editor" ON storage.objects;

-- INSERT: Editor+ can upload assets (including thumbnails in subdirectories)
-- Path formats:
-- - workspaces/{workspace_id}/assets/{asset_id}/{filename}
-- - workspaces/{workspace_id}/assets/{asset_id}/thumb/{filename}
-- - workspaces/{workspace_id}/assets/{asset_id}/preview/{filename}
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

