-- Add function to check if a user has write access to a workspace
-- Write access is determined by the workspace owner's subscription status
-- Allowed statuses: 'trialing', 'active', 'past_due'
-- Blocked statuses: 'inactive' (no subscription), 'canceled', 'unpaid'

-- Function to check if a workspace has write access enabled
-- Returns TRUE if the workspace owner has an active subscription (trialing, active, or past_due)
CREATE OR REPLACE FUNCTION workspace_has_write_access(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
  v_subscription_status TEXT;
BEGIN
  -- Get workspace owner
  SELECT created_by INTO v_owner_id
  FROM workspaces
  WHERE id = p_workspace_id;

  -- If workspace not found or no owner, deny access
  IF v_owner_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get owner's subscription status
  SELECT status INTO v_subscription_status
  FROM user_subscriptions
  WHERE user_id = v_owner_id;

  -- If no subscription record, deny write access (require trial/subscription)
  IF v_subscription_status IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Allow write access for trialing, active, or past_due statuses
  RETURN v_subscription_status IN ('trialing', 'active', 'past_due');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get workspace owner's subscription status
-- Returns subscription details needed for UI display
CREATE OR REPLACE FUNCTION get_workspace_owner_subscription(p_workspace_id UUID)
RETURNS TABLE (
  owner_id UUID,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.created_by AS owner_id,
    COALESCE(us.status, 'none') AS status,
    us.current_period_end,
    COALESCE(us.cancel_at_period_end, FALSE) AS cancel_at_period_end
  FROM workspaces w
  LEFT JOIN user_subscriptions us ON us.user_id = w.created_by
  WHERE w.id = p_workspace_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION workspace_has_write_access IS 'Check if workspace has write access based on owner subscription. Returns TRUE for trialing, active, or past_due.';
COMMENT ON FUNCTION get_workspace_owner_subscription IS 'Get workspace owner subscription details for UI display.';
