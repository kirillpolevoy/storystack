-- Add date_taken column to assets table
-- This stores the date when the photo was taken (from EXIF), not when it was imported

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS date_taken TIMESTAMPTZ;

-- Add index for date filtering
CREATE INDEX IF NOT EXISTS idx_assets_date_taken ON assets(date_taken);

-- Add comment
COMMENT ON COLUMN assets.date_taken IS 'Date when the photo was taken (from EXIF metadata). Falls back to created_at if not available.';

