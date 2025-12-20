-- Add function to get workspace members with emails
-- This function uses SECURITY DEFINER to safely access auth.users

CREATE OR REPLACE FUNCTION get_workspace_members_with_emails(workspace_id_param UUID)
RETURNS TABLE (
  workspace_id UUID,
  user_id UUID,
  role TEXT,
  created_at TIMESTAMPTZ,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wm.workspace_id,
    wm.user_id,
    wm.role,
    wm.created_at,
    COALESCE(u.email, 'Unknown') as email
  FROM workspace_members wm
  LEFT JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = workspace_id_param
    AND is_workspace_member(workspace_id_param)  -- Ensure user can only see members of workspaces they belong to
  ORDER BY wm.created_at ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_workspace_members_with_emails(UUID) TO authenticated;

COMMENT ON FUNCTION get_workspace_members_with_emails IS 'Get workspace members with their email addresses. Only returns members of workspaces the current user belongs to.';

