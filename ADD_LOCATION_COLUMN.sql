-- Add location column to assets table
-- Location is stored as a separate column, not as a tag
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Create index for efficient location-based queries
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location) 
WHERE location IS NOT NULL;

-- Add comment
COMMENT ON COLUMN assets.location IS 'City name where the photo was taken, extracted from EXIF metadata or manually entered by user';
