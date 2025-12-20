-- Ensure all workspaces have tag_config entries
-- This prevents autotagging from failing when tag_config doesn't exist

-- Insert tag_config for workspaces that don't have one
INSERT INTO tag_config (workspace_id, auto_tags)
SELECT 
  w.id as workspace_id,
  ARRAY[]::text[] as auto_tags  -- Start with empty array, users can enable tags in UI
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM tag_config tc WHERE tc.workspace_id = w.id
)
ON CONFLICT (workspace_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE tag_config IS 
  'Tag configuration per workspace. auto_tags array contains tag names enabled for AI auto-tagging. Empty array means no autotagging.';

