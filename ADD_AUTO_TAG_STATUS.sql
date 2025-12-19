-- Add auto_tag_status column to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS auto_tag_status TEXT DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN assets.auto_tag_status IS 'Status of auto-tagging: pending, failed, completed, or null';

-- Create index for faster queries on pending/failed assets
CREATE INDEX IF NOT EXISTS idx_assets_auto_tag_status ON assets(auto_tag_status) WHERE auto_tag_status IS NOT NULL;











