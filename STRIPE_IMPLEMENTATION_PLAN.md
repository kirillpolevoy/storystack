# Stripe Subscription Integration - Implementation Plan

## Overview

**Goal:** Add Stripe subscription integration to StoryStack with a phased approach:
- **Phase 1 (NOW):** Single flat price for immediate demo revenue
- **Phase 2 (FUTURE):** Tiered pricing with quota enforcement

**Business Model:**
- **User-level subscriptions** (user pays once, gets quota for multiple workspaces)
- One user → one subscription → multiple workspaces (up to quota)
- Collaborators/members are free (don't need subscriptions)

**Use Cases:**
- **Marketing Agency**: Manage multiple client brands (each client = workspace)
- **SMB Multi-Brand**: Manage multiple brand workspaces under one subscription

**Pricing Strategy:**
- **Phase 1:** Single price tier with both monthly and annual options
  - Monthly: $149/mo - all customers get same generous quota
  - Annual: $1,490/yr (save $298/year, ~17% off)
- **Phase 2:** Tiered pricing with monthly + annual for each tier
  - Tier 1: $149/mo or $1,490/yr → 1 workspace, 10 members
  - Tier 2: $250/mo or $2,500/yr → 2 workspaces, 20 members
  - Tier 3: $400/mo or $4,000/yr → 4 workspaces, 40 members

**Annual Billing Benefits:**
- **Revenue:** Improves cash flow with upfront payment
- **Retention:** Reduces churn (users committed for full year)
- **Pricing Power:** 17% discount is attractive but still profitable
- **Customer Psychology:** Annual saves "2 months free" - easy to communicate

---

## Architecture Decisions

### Subscription Scope
- **One subscription per user** (not per workspace)
- User pays once, gets quota (workspaces + members)
- Can create multiple workspaces up to quota limit
- All owned workspaces share the same subscription quota

### Example Flow
**Marketing Agency with $400/mo plan:**
- User: Agency Owner
- Subscription: $400/mo → 4 workspaces, 40 members total
- Creates 4 workspaces:
  1. Nike Brand (10 members)
  2. Adidas Brand (12 members)
  3. Puma Brand (8 members)
  4. Reebok Brand (10 members)
- Total: 4 workspaces, 40 members ✅ Within quota

### Data Flow
1. User subscribes → Stripe checkout → webhook creates user subscription record
2. User creates workspaces → system checks quota before allowing creation
3. User invites members → system checks total member count across all workspaces
4. Stripe sends billing events → webhooks update subscription status and quotas
5. Frontend displays quota usage: "2 / 4 workspaces, 15 / 40 members"

---

## Database Schema

### New Tables

#### 1. `user_subscriptions`
Tracks subscription for each user (one subscription per user).

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_customer_id TEXT UNIQUE, -- User's Stripe customer ID
  stripe_subscription_id TEXT UNIQUE, -- Stripe subscription ID
  stripe_price_id TEXT, -- Price/plan ID from Stripe

  -- Subscription details
  status TEXT NOT NULL DEFAULT 'inactive', -- inactive, active, trialing, past_due, canceled, unpaid
  plan_name TEXT, -- For display: "Starter", "Pro", "Enterprise"
  billing_interval TEXT, -- 'month' or 'year'

  -- Quota limits (Phase 2)
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
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
```

#### 2. `stripe_events`
Logs all webhook events from Stripe for debugging and idempotency.

```sql
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL, -- Stripe's event ID
  event_type TEXT NOT NULL, -- e.g., "customer.subscription.updated"

  -- Payload
  data JSONB NOT NULL, -- Full event data from Stripe

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stripe_events_event_type ON stripe_events(event_type);
CREATE INDEX idx_stripe_events_processed ON stripe_events(processed);
```

### Database Functions for Quota Checking

#### Function: Get User's Workspace Count
```sql
CREATE OR REPLACE FUNCTION get_user_workspace_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM workspaces
  WHERE created_by = p_user_id
    AND status != 'deleted';
$$ LANGUAGE SQL STABLE;
```

#### Function: Get User's Total Member Count
```sql
CREATE OR REPLACE FUNCTION get_user_total_member_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT wm.user_id)::INTEGER
  FROM workspace_members wm
  JOIN workspaces w ON wm.workspace_id = w.id
  WHERE w.created_by = p_user_id
    AND w.status != 'deleted';
$$ LANGUAGE SQL STABLE;
```

#### Function: Check if User Can Create Workspace
```sql
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

  -- If no subscription, allow 1 free workspace (or return false for strict enforcement)
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
```

#### Function: Check if User Can Add Member
```sql
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

  -- If no subscription, allow limited members
  IF NOT FOUND THEN
    RETURN get_user_total_member_count(p_user_id) < 3; -- 3 free members
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
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- user_subscriptions: Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- user_subscriptions: Only system can insert/update (via service role)
-- No public INSERT/UPDATE policies - only webhook API can modify

-- stripe_events: No public access (service role only)
```

---

## API Routes

### 1. `POST /api/stripe/create-checkout-session`
Creates a Stripe Checkout session for user subscription.

**Request Body:**
```typescript
{
  interval: 'month' | 'year';  // Billing interval (monthly or annual)
  priceId?: string;            // Optional for Phase 2 (tier selection)
}
```

**Flow:**
1. Get authenticated user ID from Supabase session
2. Check if user already has active subscription (prevent duplicate subscriptions)
3. Get or create Stripe customer ID for user
4. Determine price ID based on interval:
   - Phase 1: Use `STRIPE_MONTHLY_PRICE_ID` or `STRIPE_ANNUAL_PRICE_ID` from env
   - Phase 2: Use provided `priceId` parameter
5. Create Checkout session with:
   - Success URL: `/app/subscription?success=true`
   - Cancel URL: `/app/subscription?canceled=true`
   - Metadata: `{ user_id, billing_interval }`
   - Customer email pre-filled from Supabase user
   - Allow promotion codes (for custom discounts)
6. Return checkout session URL

**Response:**
```typescript
{
  url: string; // Redirect user to this Stripe Checkout URL
}
```

**Implementation Notes:**
- Store Stripe customer ID in `user_subscriptions` table
- Extract `billing_interval` from Stripe price object in webhook
- For Phase 1: Accept `interval` param, use corresponding env var price ID
- For Phase 2: Accept `priceId` directly (for tier + interval combo)

---

### 2. `POST /api/stripe/webhook`
Handles Stripe webhook events.

**Webhook Events to Handle:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update user subscription record |
| `customer.subscription.created` | Create user subscription record |
| `customer.subscription.updated` | Update subscription status, quotas, period dates |
| `customer.subscription.deleted` | Mark subscription as canceled |
| `invoice.payment_succeeded` | Update payment status, extend period |
| `invoice.payment_failed` | Mark as past_due, notify user |

**Flow:**
1. Verify webhook signature (security)
2. Check if event already processed (idempotency)
3. Log event to `stripe_events` table
4. Handle event based on type:
   - Extract user_id from metadata or customer mapping
   - Extract billing_interval from `subscription.items.data[0].price.recurring.interval`
   - Update `user_subscriptions` table with status, billing_interval, quotas
   - Update quotas from price metadata if changed
5. Mark event as processed

**Important:**
- Use Supabase service role client (bypass RLS)
- Implement idempotency (check `stripe_event_id` before processing)
- Return 200 quickly (Stripe times out at 30s)
- Extract billing_interval from Stripe subscription object (month or year)
- Extract quotas from Stripe price metadata (Phase 2)

---

### 3. `POST /api/stripe/create-portal-session`
Creates a Stripe Customer Portal session for managing subscription.

**Request Body:**
```typescript
{} // No parameters needed - uses authenticated user
```

**Flow:**
1. Get authenticated user ID
2. Get Stripe customer ID from user subscription
3. Create portal session with return URL: `/app/subscription`
4. Return portal URL

**Response:**
```typescript
{
  url: string; // Redirect to Stripe Customer Portal
}
```

**Customer Portal Features:**
- Update payment method
- View invoices
- Cancel subscription
- (Phase 2) Upgrade/downgrade plan

---

### 4. `GET /api/subscriptions/status`
Gets subscription details and quota usage for authenticated user.

**Response:**
```typescript
{
  subscription: {
    status: 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled';
    planName?: string;
    billingInterval?: 'month' | 'year';
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    maxWorkspaces: number;
    maxMembers: number;
  } | null;

  usage: {
    workspaceCount: number;
    memberCount: number;
  };

  canCreateWorkspace: boolean;
  canAddMember: boolean;
}
```

**Flow:**
1. Get authenticated user ID
2. Query `user_subscriptions` for subscription details
3. Call quota functions to get current usage
4. Return combined data

---

### 5. `GET /api/subscriptions/check-quota`
Quick endpoint to check if user can perform an action.

**Query Parameters:**
- `action`: "create_workspace" | "add_member"

**Response:**
```typescript
{
  allowed: boolean;
  reason?: string; // If not allowed: "quota_exceeded", "no_subscription", "subscription_inactive"
  current: number;
  limit: number;
}
```

---

## Stripe Setup

### 1. Stripe Dashboard Configuration

**Products & Prices:**

**Phase 1:** Create 1 product with 2 prices (monthly + annual)
- Product: "StoryStack Pro"
- **Monthly Price:** $149/month recurring
  - Billing period: Monthly
  - Metadata: `max_workspaces=10, max_members=50`
  - Note the `price_id` (e.g., `price_monthly_xxx`)
- **Annual Price:** $1,490/year recurring (~17% off, 2 months free)
  - Billing period: Yearly
  - Metadata: `max_workspaces=10, max_members=50`
  - Note the `price_id` (e.g., `price_annual_xxx`)
  - Savings: $298/year vs monthly ($149 × 12 = $1,788)

**Phase 2:** Add more pricing tiers (each with monthly + annual)
- **Tier 1 - Starter:**
  - Monthly: $149/mo → Annual: $1,490/yr (save $298)
  - Metadata: `max_workspaces=1, max_members=10`
- **Tier 2 - Pro:**
  - Monthly: $250/mo → Annual: $2,500/yr (save $500)
  - Metadata: `max_workspaces=2, max_members=20`
- **Tier 3 - Enterprise:**
  - Monthly: $400/mo → Annual: $4,000/yr (save $800)
  - Metadata: `max_workspaces=4, max_members=40`

**Discount Structure:** Annual plans include 2 months free (~17% discount)
- Formula: `annual_price = monthly_price × 10`

**Webhooks:**
- Endpoint: `https://yourdomain.com/api/stripe/webhook`
- Events to subscribe:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Get webhook signing secret (`whsec_xxx`)

**Customer Portal:**
- Enable in Stripe Dashboard
- Configure allowed actions:
  - ✅ Update payment method
  - ✅ View invoices
  - ✅ Cancel subscription
  - (Phase 2) ✅ Switch plans

### 2. Environment Variables

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_xxx               # Server-side only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx  # Client-side safe
STRIPE_WEBHOOK_SECRET=whsec_xxx             # Webhook signature verification

# Default price IDs (Phase 1)
STRIPE_MONTHLY_PRICE_ID=price_monthly_xxx   # $149/month
STRIPE_ANNUAL_PRICE_ID=price_annual_xxx     # $1,490/year

# Expose to client for plan selection (Phase 2)
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_monthly_xxx
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_annual_xxx
```

---

## Frontend Components

### 1. Subscription Page (`/app/subscription/page.tsx`)
Replace placeholder with user subscription UI.

**Features:**
- Show user's subscription status
- Display quota usage (workspaces & members)
- List all owned workspaces
- "Subscribe" button (if no subscription)
- "Manage Billing" button (if has subscription)
- Plan upgrade prompts (Phase 2)

**Phase 1 UI (Active Subscription):**
```
┌─────────────────────────────────────────────┐
│ Your Subscription                           │
│                                             │
│ StoryStack Pro - $149/month                 │
│ Status: Active ✓                            │
│ Next billing: Jan 15, 2025                  │
│                                             │
│ Usage:                                      │
│ • Workspaces: 2 / 10                        │
│ • Team Members: 15 / 50                     │
│                                             │
│ [Manage Billing]                            │
│                                             │
│ Your Workspaces:                            │
│ • Brand Team Alpha (8 members)             │
│ • Marketing Assets (7 members)             │
│                                             │
└─────────────────────────────────────────────┘
```

**Phase 1 UI (No Subscription - Signup):**
```
┌─────────────────────────────────────────────────────┐
│ Choose Your Plan                                    │
│                                                     │
│ StoryStack Pro                                      │
│                                                     │
│ [Monthly]  [Annual - Save $298/year]  ← Toggle     │
│                                                     │
│ ┌─────────────────────┐  ┌─────────────────────┐   │
│ │   Monthly           │  │   Annual            │   │
│ │   $149/month        │  │   $1,490/year       │   │
│ │                     │  │   ($124/month)      │   │
│ │   Billed monthly    │  │   Save 17%          │   │
│ │                     │  │   Billed yearly     │   │
│ │   [Subscribe]       │  │   [Subscribe]       │   │
│ └─────────────────────┘  └─────────────────────┘   │
│                                                     │
│ Includes:                                           │
│ • 10 Workspaces                                     │
│ • 50 Team Members                                   │
│ • AI-powered organization                           │
│ • Unlimited assets                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Phase 2 UI:** Add tier selection + billing interval toggle

---

### 2. Billing Interval Toggle Component
Component for switching between monthly/annual billing.

**Props:**
```typescript
interface BillingToggleProps {
  value: 'month' | 'year';
  onChange: (interval: 'month' | 'year') => void;
  monthlyPrice: number;
  annualPrice: number;
  showSavings?: boolean; // Default: true
}
```

**UI Example:**
```
┌──────────────────────────────────┐
│  ( ) Monthly  (•) Annual         │
│              Save $298/year!     │
└──────────────────────────────────┘
```

**Implementation:**
- Use Radix UI Radio Group or Tabs
- Highlight annual savings
- Default to monthly (lower barrier to entry)
- Store selection in component state before checkout

---

### 3. Workspace Creation Flow
Before creating workspace, check quota.

**Location:** Workspace creation dialog/page

**Flow:**
1. User clicks "Create Workspace"
2. Check `can_user_create_workspace()` or call `/api/subscriptions/check-quota?action=create_workspace`
3. If quota exceeded:
   - Show modal: "You've reached your workspace limit (2 / 2). Upgrade to create more workspaces."
   - Show upgrade button → subscription page
4. If allowed: Proceed with creation

---

### 3. Member Invitation Flow
Before adding member, check quota.

**Location:** Member invitation dialog

**Flow:**
1. User enters member email
2. Before sending invite, check `/api/subscriptions/check-quota?action=add_member`
3. If quota exceeded:
   - Show error: "You've reached your member limit (40 / 40). Upgrade to add more team members."
   - Show upgrade button
4. If allowed: Send invite

---

### 4. Quota Usage Indicator Component
Shows quota usage in header or sidebar.

**Props:**
```typescript
interface QuotaIndicatorProps {
  type: 'workspaces' | 'members';
  current: number;
  limit: number;
}
```

**UI Examples:**
- `2 / 10 workspaces` (green if < 80%)
- `9 / 10 workspaces` (yellow if 80-99%)
- `10 / 10 workspaces` (red if 100%)

---

### 5. Subscription Status Hook
React hook for accessing subscription data.

**Usage:**
```typescript
const { subscription, usage, canCreateWorkspace, isLoading } = useSubscription();

// In workspace creation handler:
if (!canCreateWorkspace) {
  showUpgradeModal();
  return;
}
```

---

## Implementation Steps

### Phase 1: Minimal Viable Subscription (Demo-Ready)

#### Step 1: Stripe Account Setup
- [ ] Create/configure Stripe account
- [ ] Create product: "StoryStack Pro"
- [ ] Create monthly price: $149/month
  - Add metadata: `max_workspaces=10, max_members=50`
  - Note the price_id
- [ ] Create annual price: $1,490/year
  - Add metadata: `max_workspaces=10, max_members=50`
  - Note the price_id
- [ ] Get API keys (test mode)
- [ ] Set up webhook endpoint configuration (after deploying API route)
- [ ] Add environment variables (both monthly and annual price IDs)

#### Step 2: Database Migration
- [ ] Create migration file: `supabase/migrations/[timestamp]_add_user_subscriptions.sql`
- [ ] Add `user_subscriptions` table
- [ ] Add `stripe_events` table
- [ ] Add quota helper functions
- [ ] Add RLS policies
- [ ] Test migration locally
- [ ] Deploy to production

#### Step 3: Install Dependencies
```bash
cd apps/web
npm install stripe @stripe/stripe-js
```

#### Step 4: Create Stripe Utilities
- [ ] `/apps/web/lib/stripe/server.ts` - Server-side Stripe client
- [ ] `/apps/web/lib/stripe/client.ts` - Client-side Stripe loader
- [ ] `/apps/web/lib/stripe/config.ts` - Shared config/types
- [ ] `/apps/web/types/subscription.ts` - TypeScript types

#### Step 5: API Routes
- [ ] `/apps/web/app/api/stripe/create-checkout-session/route.ts`
- [ ] `/apps/web/app/api/stripe/webhook/route.ts`
- [ ] `/apps/web/app/api/stripe/create-portal-session/route.ts`
- [ ] `/apps/web/app/api/subscriptions/status/route.ts`
- [ ] `/apps/web/app/api/subscriptions/check-quota/route.ts`

#### Step 6: React Hooks & Context
- [ ] `/apps/web/hooks/useSubscription.ts` - Subscription data hook
- [ ] Add subscription to React Query setup
- [ ] Cache subscription status for performance

#### Step 7: Frontend Components
- [ ] Update `/apps/web/app/app/subscription/page.tsx`
- [ ] Create `BillingToggle` component (monthly/annual selection)
- [ ] Create `SubscribeButton` component (accepts billing interval)
- [ ] Create `ManageBillingButton` component
- [ ] Create `QuotaIndicator` component
- [ ] Add quota checks to workspace creation flow
- [ ] Add quota checks to member invitation flow

#### Step 8: Testing
- [ ] Test monthly checkout flow with test card (4242 4242 4242 4242)
- [ ] Test annual checkout flow with test card
- [ ] Verify billing_interval stored correctly in database
- [ ] Test webhook handling with Stripe CLI:
  ```bash
  stripe listen --forward-to localhost:3000/api/stripe/webhook
  stripe trigger checkout.session.completed
  ```
- [ ] Test portal access (verify plan switching between monthly/annual)
- [ ] Verify subscription status updates in database
- [ ] Test quota functions
- [ ] Test with multiple workspaces and members

#### Step 9: Production Deployment
- [ ] Deploy Next.js app with webhook route
- [ ] Configure Stripe webhook in dashboard with production URL
- [ ] Switch to live Stripe keys
- [ ] Test with real payment (use small amount, refund after)
- [ ] Monitor webhook logs

**Phase 1 Deliverables:**
✅ User can subscribe via Stripe Checkout
✅ Subscription status tracked in database
✅ Customer portal access for billing management
✅ Subscription page shows status and quota usage
✅ Generous quotas (no hard enforcement yet)

---

### Phase 2: Tiered Pricing & Strict Quota Enforcement

#### Step 1: Stripe Configuration
- [ ] Create additional price tiers ($250, $400)
- [ ] Add metadata to each price (max_workspaces, max_members)
- [ ] Enable plan switching in Customer Portal
- [ ] Configure proration settings (recommended: always_invoice)

#### Step 2: Database Updates
- [ ] Migration to update default quotas if needed
- [ ] Add indexes for performance if needed

#### Step 3: Quota Enforcement Logic
- [ ] Add database trigger/constraint to prevent workspace creation over quota (optional)
- [ ] Update workspace creation API to strictly check quota
- [ ] Update member invitation API to strictly check quota
- [ ] Add background job to check and alert users near limits (optional)

#### Step 4: UI Enhancements
- [ ] Plan selection page with tier comparison
- [ ] Quota usage meters/progress bars
- [ ] Upgrade prompts when approaching limits (e.g., 80% usage)
- [ ] Blocked state UI when quota exceeded
- [ ] Plan comparison table

#### Step 5: Upgrade/Downgrade Flows
- [ ] API route for plan changes: `/api/stripe/update-subscription`
- [ ] Handle proration in webhook
- [ ] UI for switching plans from subscription page
- [ ] Confirmation modals for downgrades (warn about losing access)
- [ ] Handle edge cases (downgrade when over new quota)

#### Step 6: Analytics & Monitoring
- [ ] Track subscription conversion rate
- [ ] Monitor failed payments
- [ ] Alert on webhook processing errors
- [ ] Dashboard for subscription metrics

---

## Key Technical Considerations

### Security
1. **Webhook Signature Verification:** Always verify `stripe-signature` header to prevent fake webhooks
2. **RLS Policies:** Users can only view their own subscription
3. **API Authentication:** All API routes verify Supabase session
4. **Quota Bypass Prevention:** Use database functions, not just frontend checks

### Idempotency
- Store `stripe_event_id` before processing webhook
- Check if event already processed (prevents duplicate subscription updates)
- Use database transactions for webhook handlers

### Error Handling
- Graceful failures on checkout errors (network issues, card declined)
- Retry logic for webhook processing (Stripe auto-retries, log failures)
- User-friendly error messages (avoid technical jargon)
- Admin notifications for failed payments via email/Slack

### Performance
- Index `user_id`, `stripe_customer_id` for fast lookups
- Cache subscription status in React Query (5-minute stale time)
- Use database functions for quota checks (single query)
- Optimize member count query for large workspaces

### Testing Strategy
- **Local Development:**
  - Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  - Test cards: 4242 4242 4242 4242 (success), 4000 0000 0000 0002 (decline)
- **Staging:** Test full flow with Stripe test mode
- **Production:** Small real transaction before launch, immediate refund

### Edge Cases to Handle
1. **User downgrades but over new quota:**
   - Allow existing resources to remain (grandfather)
   - Block new creation until under quota
2. **Subscription canceled but not expired:**
   - Allow access until end of billing period
   - Show banner: "Subscription ends on {date}"
3. **Payment failed:**
   - Grace period (e.g., 7 days)
   - Send reminder emails (Stripe handles this)
   - Soft-lock features (read-only mode)
4. **User creates workspace then subscription fails:**
   - Allow workspace to remain in "unpaid" state
   - Require subscription to activate

---

## File Structure

```
apps/web/
├── app/
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── create-checkout-session/
│   │   │   │   └── route.ts
│   │   │   ├── create-portal-session/
│   │   │   │   └── route.ts
│   │   │   ├── webhook/
│   │   │   │   └── route.ts
│   │   │   └── update-subscription/      (Phase 2)
│   │   │       └── route.ts
│   │   └── subscriptions/
│   │       ├── status/
│   │       │   └── route.ts
│   │       └── check-quota/
│   │           └── route.ts
│   └── app/
│       └── subscription/
│           └── page.tsx (update existing)
│
├── lib/
│   └── stripe/
│       ├── server.ts       # Server-side Stripe client
│       ├── client.ts       # Client-side Stripe loader
│       ├── config.ts       # Shared types/config
│       └── webhooks.ts     # Webhook event handlers
│
├── hooks/
│   ├── useSubscription.ts  # Main subscription hook
│   └── useQuotaCheck.ts    # Quota checking hook (Phase 2)
│
├── components/
│   └── subscription/
│       ├── BillingToggle.tsx       # Monthly/Annual toggle
│       ├── SubscribeButton.tsx
│       ├── ManageBillingButton.tsx
│       ├── QuotaIndicator.tsx
│       ├── UpgradePrompt.tsx
│       └── PlanComparisonTable.tsx (Phase 2)
│
└── types/
    └── subscription.ts     # TypeScript interfaces

supabase/
└── migrations/
    └── [timestamp]_add_user_subscriptions.sql
```

---

## Success Criteria

### Phase 1
- [ ] User can choose between monthly and annual billing
- [ ] User can subscribe via Stripe Checkout (both intervals work)
- [ ] Billing interval stored and displayed correctly
- [ ] Annual discount clearly communicated ("Save $298/year")
- [ ] Subscription status updates automatically via webhooks
- [ ] User can manage billing via Customer Portal (can switch between monthly/annual)
- [ ] Subscription page displays status, billing interval, and quota usage
- [ ] Quota displayed but not strictly enforced (soft limits)
- [ ] All owned workspaces listed on subscription page

### Phase 2
- [ ] Multiple pricing tiers available for selection
- [ ] Strict quota enforcement (cannot exceed limits)
- [ ] Upgrade/downgrade between plans with proration
- [ ] Quota usage displayed throughout app
- [ ] Blocking UI when quota exceeded with upgrade prompts
- [ ] Email notifications for quota warnings

---

## Timeline Estimate

**Phase 1 (Demo-Ready):**
- Stripe Setup: 1 hour
- Database Schema: 2 hours (includes functions)
- API Routes: 4-5 hours
- Frontend Components: 3-4 hours
- React hooks/integration: 2 hours
- Testing: 3-4 hours
- **Total: 1.5-2 days**

**Phase 2 (Full Tiered System):**
- Stripe Configuration: 1 hour
- Strict Quota Enforcement: 3-4 hours
- UI Enhancements: 4-5 hours
- Plan switching: 2-3 hours
- Testing & Edge Cases: 3-4 hours
- **Total: 1.5-2 days**

---

## Migration Path for Existing Users

**Scenario:** You have users with workspaces before subscriptions exist.

**Options:**

1. **Grandfather Existing Users (Recommended for MVP):**
   - Give all existing users free Pro plan (or trial)
   - Set generous quotas
   - Announce subscription launch with grace period

2. **Require Subscription:**
   - Give 14-day trial on first login after launch
   - Send email announcement before enforcement
   - Soft-lock workspaces after trial (read-only)

3. **Freemium Model:**
   - Allow 1 free workspace, 3 members forever
   - Require subscription for additional workspaces

---

## Questions to Resolve

1. **Free Tier:** Should there be a free tier? (e.g., 1 workspace, 3 members)
2. **Trial Period:** Should new users get a free trial? (e.g., 14 days)
3. **Grace Period:** How long after payment failure before locking access?
4. **Downgrade Handling:** What happens if user downgrades below current usage?
5. **Refund Policy:** Prorated refunds on cancellation?
6. **Tax Handling:** Enable Stripe Tax for automatic tax calculation?
7. **Existing Users:** How to handle users who already have workspaces?

---

## Next Steps

1. ✅ Review and approve this plan
2. Set up Stripe account and get API keys
3. Decide on free tier / trial policy
4. Begin Phase 1 implementation
5. Test thoroughly with test mode
6. Soft launch to beta users
7. Gather feedback
8. Launch Phase 1 for general availability
9. Monitor metrics (conversion, churn)
10. Implement Phase 2 when ready to scale pricing

---

## Resources

- [Stripe Subscriptions Docs](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Stripe Price Metadata](https://stripe.com/docs/api/prices/object#price_object-metadata)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Service Role](https://supabase.com/docs/guides/auth/service-role-key)
