-- Create function to get user emails by user IDs
-- This function uses SECURITY DEFINER to safely access auth.users
-- Matches pattern from get_workspace_members_with_emails

CREATE OR REPLACE FUNCTION get_user_emails(user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    COALESCE(u.email::TEXT, 'Unknown'::TEXT) as email
  FROM unnest(user_ids) AS uid
  LEFT JOIN auth.users u ON u.id = uid
  WHERE u.id IS NOT NULL  -- Exclude soft-deleted users
  ORDER BY u.email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_emails(UUID[]) TO authenticated;

COMMENT ON FUNCTION get_user_emails IS 'Get user emails by user IDs. Returns user_id and email for each provided user ID.';

