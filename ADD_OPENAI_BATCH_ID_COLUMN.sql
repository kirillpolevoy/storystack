-- Add openai_batch_id column to assets table for Batch API tracking
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS openai_batch_id TEXT;

-- Create index for efficient batch polling queries
CREATE INDEX IF NOT EXISTS idx_assets_openai_batch_id ON assets(openai_batch_id) 
WHERE openai_batch_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN assets.openai_batch_id IS 'OpenAI Batch API batch_id for tracking async batch processing (20+ images)';
