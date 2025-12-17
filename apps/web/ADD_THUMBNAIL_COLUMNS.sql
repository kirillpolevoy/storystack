-- Add thumbnail columns to assets table (backward-compatible)
-- These columns are nullable to maintain compatibility with existing data

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS storage_path_preview TEXT,
ADD COLUMN IF NOT EXISTS storage_path_thumb TEXT;

-- Add index for better query performance if needed
CREATE INDEX IF NOT EXISTS idx_assets_user_id_created_at ON assets(user_id, created_at DESC);

