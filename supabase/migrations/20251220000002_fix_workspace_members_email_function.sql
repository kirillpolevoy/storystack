-- Fix the get_workspace_members_with_emails function
-- Resolves circular RLS dependency by explicit membership check

DROP FUNCTION IF EXISTS get_workspace_members_with_emails(UUID);

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
SET search_path = public
AS $$
DECLARE
  v_is_member BOOLEAN;
BEGIN
  -- Explicit membership check (avoids RLS recursion)
  SELECT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_members.workspace_id = workspace_id_param 
      AND workspace_members.user_id = auth.uid()
  ) INTO v_is_member;
  
  IF NOT v_is_member THEN
    RETURN;
  END IF;

  -- Return members with emails (exclude soft-deleted users)
  RETURN QUERY
  SELECT 
    wm.workspace_id,
    wm.user_id,
    wm.role,
    wm.created_at,
    COALESCE(u.email::TEXT, 'Unknown'::TEXT) as email
  FROM workspace_members wm
  LEFT JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = workspace_id_param
    AND u.id IS NOT NULL  -- Exclude soft-deleted users
  ORDER BY wm.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_workspace_members_with_emails(UUID) TO authenticated;

COMMENT ON FUNCTION get_workspace_members_with_emails IS 'Get workspace members with emails. Explicit membership check avoids RLS recursion.';
