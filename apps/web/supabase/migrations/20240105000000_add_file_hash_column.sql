-- Add file_hash column to assets table for duplicate detection
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Add index for efficient duplicate lookups
CREATE INDEX IF NOT EXISTS idx_assets_file_hash ON assets(file_hash);

-- Add index on user_id + file_hash for faster duplicate checks per user
CREATE INDEX IF NOT EXISTS idx_assets_user_file_hash ON assets(user_id, file_hash);

COMMENT ON COLUMN assets.file_hash IS 'SHA-256 hash of the image file for duplicate detection';

