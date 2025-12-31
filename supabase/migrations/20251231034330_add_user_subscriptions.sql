-- Stripe Subscription Integration
-- This migration adds support for user-level subscriptions with Stripe

-- ============================================================================
-- TABLES
-- ============================================================================

-- user_subscriptions: Tracks subscription for each user (one subscription per user)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Subscription details
  status TEXT NOT NULL DEFAULT 'inactive',
  plan_name TEXT,
  billing_interval TEXT,

  -- Quota limits
  max_workspaces INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 10,

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- stripe_events: Logs all webhook events from Stripe for debugging and idempotency
CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,

  -- Payload
  data JSONB NOT NULL,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_type ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_events_stripe_event_id ON stripe_events(stripe_event_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get user's workspace count
CREATE OR REPLACE FUNCTION get_user_workspace_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM workspaces
  WHERE created_by = p_user_id
    AND status != 'deleted';
$$ LANGUAGE SQL STABLE;

-- Get user's total member count across all workspaces
CREATE OR REPLACE FUNCTION get_user_total_member_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT wm.user_id)::INTEGER
  FROM workspace_members wm
  JOIN workspaces w ON wm.workspace_id = w.id
  WHERE w.created_by = p_user_id
    AND w.status != 'deleted';
$$ LANGUAGE SQL STABLE;

-- Check if user can create a workspace (quota check)
CREATE OR REPLACE FUNCTION can_user_create_workspace(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_max_workspaces INTEGER;
  v_subscription_status TEXT;
BEGIN
  -- Get subscription details
  SELECT max_workspaces, status
  INTO v_max_workspaces, v_subscription_status
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  -- If no subscription, allow 1 free workspace (freemium model)
  IF NOT FOUND THEN
    RETURN get_user_workspace_count(p_user_id) < 1;
  END IF;

  -- Check subscription is active
  IF v_subscription_status NOT IN ('active', 'trialing') THEN
    RETURN FALSE;
  END IF;

  -- Check quota
  v_current_count := get_user_workspace_count(p_user_id);
  RETURN v_current_count < v_max_workspaces;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if user can add a member (quota check)
CREATE OR REPLACE FUNCTION can_user_add_member(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_max_members INTEGER;
  v_subscription_status TEXT;
BEGIN
  -- Get subscription details
  SELECT max_members, status
  INTO v_max_members, v_subscription_status
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  -- If no subscription, allow 3 free members
  IF NOT FOUND THEN
    RETURN get_user_total_member_count(p_user_id) < 3;
  END IF;

  -- Check subscription is active
  IF v_subscription_status NOT IN ('active', 'trialing') THEN
    RETURN FALSE;
  END IF;

  -- Check quota
  v_current_count := get_user_total_member_count(p_user_id);
  RETURN v_current_count < v_max_members;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- user_subscriptions: Users can view their own subscription
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- stripe_events: No public access (service role only)
-- No policies needed - only service role can access

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_subscriptions IS 'Stores user subscription information from Stripe. One subscription per user, covers all their workspaces.';
COMMENT ON TABLE stripe_events IS 'Logs all Stripe webhook events for idempotency and debugging.';
COMMENT ON FUNCTION get_user_workspace_count IS 'Returns count of active workspaces owned by user.';
COMMENT ON FUNCTION get_user_total_member_count IS 'Returns total unique members across all workspaces owned by user.';
COMMENT ON FUNCTION can_user_create_workspace IS 'Checks if user can create another workspace based on subscription quota.';
COMMENT ON FUNCTION can_user_add_member IS 'Checks if user can add another member based on subscription quota.';
