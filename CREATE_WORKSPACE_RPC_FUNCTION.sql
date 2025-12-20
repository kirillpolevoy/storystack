-- Create workspace via RPC function (bypasses RLS)
-- This is a more reliable approach than relying on RLS policies

CREATE OR REPLACE FUNCTION create_workspace(workspace_name TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_by UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_id_val UUID;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create a workspace';
  END IF;

  -- Create workspace
  INSERT INTO workspaces (name, created_by, status)
  VALUES (workspace_name, current_user_id, 'active')
  RETURNING id INTO workspace_id_val;
  
  -- Add creator as owner
  INSERT INTO workspace_members (workspace_id, user_id, role, created_by)
  VALUES (workspace_id_val, current_user_id, 'owner', current_user_id);
  
  -- Create default tag_config
  INSERT INTO tag_config (workspace_id, auto_tags)
  VALUES (workspace_id_val, ARRAY[]::TEXT[])
  ON CONFLICT (workspace_id) DO NOTHING;
  
  -- Return the created workspace
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.created_by,
    w.status,
    w.created_at,
    w.updated_at
  FROM workspaces w
  WHERE w.id = workspace_id_val;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_workspace(TEXT) TO authenticated;

COMMENT ON FUNCTION create_workspace IS 'Creates a new workspace for the authenticated user. Bypasses RLS using SECURITY DEFINER.';

