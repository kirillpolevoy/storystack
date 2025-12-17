-- Add original_filename column to assets table
-- This stores the original filename from upload, separate from the storage_path filename

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Add index for efficient queries if needed
CREATE INDEX IF NOT EXISTS idx_assets_original_filename ON assets(original_filename);

COMMENT ON COLUMN assets.original_filename IS 'Original filename from upload (before renaming for storage). Used for display purposes.';

