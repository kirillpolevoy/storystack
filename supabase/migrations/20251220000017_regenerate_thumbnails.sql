-- Migration to regenerate thumbnails for existing assets
-- This addresses the pixelation issue by regenerating thumbnails at 800px instead of 400px

-- Add a column to track if thumbnails need regeneration
-- This allows us to batch process assets that need new thumbnails
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS thumb_regenerated_at TIMESTAMPTZ;

-- Create a function to get assets that need thumbnail regeneration
-- Assets uploaded before the thumbnail size change (Dec 20, 2025) need regeneration
CREATE OR REPLACE FUNCTION get_assets_needing_thumbnail_regeneration(
  batch_size INTEGER DEFAULT 100,
  workspace_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  storage_path TEXT,
  storage_path_thumb TEXT,
  workspace_id UUID,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.storage_path,
    a.storage_path_thumb,
    a.workspace_id,
    a.created_at
  FROM assets a
  WHERE 
    a.deleted_at IS NULL
    AND a.storage_path_thumb IS NOT NULL
    AND a.thumb_regenerated_at IS NULL
    AND (workspace_id_filter IS NULL OR a.workspace_id = workspace_id_filter)
  ORDER BY a.created_at ASC
  LIMIT batch_size;
END;
$$;

-- Create a function to mark thumbnails as regenerated
CREATE OR REPLACE FUNCTION mark_thumbnail_regenerated(asset_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE assets
  SET thumb_regenerated_at = NOW()
  WHERE id = asset_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_assets_needing_thumbnail_regeneration TO authenticated;
GRANT EXECUTE ON FUNCTION mark_thumbnail_regenerated TO authenticated;

-- Add comment explaining the migration
COMMENT ON COLUMN assets.thumb_regenerated_at IS 'Timestamp when thumbnail was regenerated at 800px resolution to fix pixelation issues. NULL means thumbnail needs regeneration.';
COMMENT ON FUNCTION get_assets_needing_thumbnail_regeneration IS 'Returns assets that need thumbnail regeneration (uploaded with old 400px thumbnails). Use this to batch process thumbnail regeneration.';
COMMENT ON FUNCTION mark_thumbnail_regenerated IS 'Marks an asset as having its thumbnail regenerated. Call this after successfully regenerating the thumbnail.';

