-- Fix workspace count function to only count active workspaces
-- Previously it excluded only 'deleted', but should only count 'active'
-- (excludes both 'deleted' and 'archived' workspaces)

CREATE OR REPLACE FUNCTION get_user_workspace_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM workspaces
  WHERE created_by = p_user_id
    AND status = 'active';
$$ LANGUAGE SQL STABLE;

-- Also update member count to only count members in active workspaces
CREATE OR REPLACE FUNCTION get_user_total_member_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT wm.user_id)::INTEGER
  FROM workspace_members wm
  JOIN workspaces w ON wm.workspace_id = w.id
  WHERE w.created_by = p_user_id
    AND w.status = 'active';
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_user_workspace_count IS 'Returns count of active workspaces owned by user (excludes archived and deleted).';
COMMENT ON FUNCTION get_user_total_member_count IS 'Returns total unique members across active workspaces owned by user.';
