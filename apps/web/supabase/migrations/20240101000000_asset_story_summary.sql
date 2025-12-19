-- Create view for asset story membership summary
-- This view aggregates story membership data per asset for efficient querying

CREATE OR REPLACE VIEW asset_story_summary AS
SELECT 
  sa.asset_id,
  ARRAY_AGG(DISTINCT sa.story_id) FILTER (WHERE sa.story_id IS NOT NULL) AS story_ids,
  ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL) AS story_names,
  COUNT(DISTINCT sa.story_id) AS story_count
FROM story_assets sa
LEFT JOIN stories s ON sa.story_id = s.id
GROUP BY sa.asset_id;

-- Create index on asset_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_asset_story_summary_asset_id ON story_assets(asset_id);

-- Grant access to authenticated users (RLS will handle filtering)
-- Note: Views inherit RLS from underlying tables, but we need to ensure the view is accessible
COMMENT ON VIEW asset_story_summary IS 'Provides aggregated story membership data per asset';


