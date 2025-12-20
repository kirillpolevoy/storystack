-- FIX: Workspace Members Email Function
-- This fixes the circular RLS dependency issue
-- Run this in your Supabase SQL Editor

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
  -- Check if caller is a member (explicit check, not via RLS)
  SELECT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_members.workspace_id = workspace_id_param 
      AND workspace_members.user_id = auth.uid()
  ) INTO v_is_member;
  
  -- Only proceed if user is a member
  IF NOT v_is_member THEN
    RETURN; -- Empty result
  END IF;

  -- Return all members with emails (bypasses RLS since we already checked)
  RETURN QUERY
  SELECT 
    wm.workspace_id,
    wm.user_id,
    wm.role,
    wm.created_at,
    COALESCE(u.email::TEXT, 'No email'::TEXT) as email
  FROM workspace_members wm
  LEFT JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = workspace_id_param
  ORDER BY wm.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_workspace_members_with_emails(UUID) TO authenticated;

COMMENT ON FUNCTION get_workspace_members_with_emails IS 'Get workspace members with emails. Checks membership explicitly to avoid RLS recursion.';

-- Test: SELECT * FROM get_workspace_members_with_emails('your-workspace-id'::UUID);
