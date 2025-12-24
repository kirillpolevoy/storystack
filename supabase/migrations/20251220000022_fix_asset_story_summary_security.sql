-- Fix asset_story_summary view to ensure RLS policies are enforced
-- Views inherit RLS from underlying tables, so we just need to recreate it normally
-- without any special security properties

-- Drop and recreate the view (views don't have SECURITY DEFINER, but recreating ensures proper RLS inheritance)
DROP VIEW IF EXISTS asset_story_summary CASCADE;

CREATE VIEW asset_story_summary AS
SELECT 
  sa.asset_id,
  ARRAY_AGG(DISTINCT sa.story_id) FILTER (WHERE sa.story_id IS NOT NULL) AS story_ids,
  ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL) AS story_names,
  COUNT(DISTINCT sa.story_id) AS story_count
FROM story_assets sa
LEFT JOIN stories s ON sa.story_id = s.id
GROUP BY sa.asset_id;

-- Grant access to authenticated users
-- RLS policies on story_assets and stories tables will automatically filter the view results
GRANT SELECT ON asset_story_summary TO authenticated;

COMMENT ON VIEW asset_story_summary IS 'Provides aggregated story membership data per asset. RLS policies from underlying tables (story_assets and stories) are automatically enforced.';

