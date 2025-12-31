# Stripe Subscription Integration - Implementation Plan

## Overview

**Goal:** Add Stripe subscription integration to StoryStack with a phased approach:
- **Phase 1 (NOW):** Single flat price for immediate demo revenue
- **Phase 2 (FUTURE):** Tiered pricing with quota enforcement

**Business Model:**
- Workspace-level subscriptions (workspace owner pays)
- User can own multiple workspaces → each workspace has its own subscription
- Collaborators/members are free (don't need subscriptions)

**Pricing Strategy:**
- **Phase 1:** Single price (e.g., $149/mo) - all customers get same plan
- **Phase 2:** Tiered pricing based on workspace count & member limits
  - $149/mo: 1 workspace, 10 members total
  - $250/mo: 2 workspaces, 20 members total
  - $400/mo: 4 workspaces, 40 members total

---

## Architecture Decisions

### Subscription Scope
- **One subscription per workspace** (not per user)
- Workspace owner is responsible for payment
- Owner can have multiple workspaces → multiple subscriptions
- Billing tied to workspace, synced to Stripe

### Data Flow
1. User creates workspace → workspace starts in "trial" or "unpaid" status
2. Owner subscribes → Stripe checkout → webhook updates workspace status
3. Stripe sends billing events → webhooks update subscription status
4. Frontend checks workspace subscription before allowing certain actions

---

## Database Schema

### New Tables

#### 1. `workspace_subscriptions`
Tracks subscription status for each workspace.

```sql
CREATE TABLE workspace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_customer_id TEXT, -- Owner's Stripe customer ID
  stripe_subscription_id TEXT UNIQUE, -- Stripe subscription ID
  stripe_price_id TEXT, -- Price/plan ID from Stripe

  -- Subscription details
  status TEXT NOT NULL DEFAULT 'inactive', -- inactive, active, trialing, past_due, canceled, unpaid
  plan_name TEXT, -- For display: "Pro", "Enterprise", etc.

  -- Quota (for Phase 2)
  max_workspaces INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 10,

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workspace_id)
);

-- Index for faster lookups
CREATE INDEX idx_workspace_subscriptions_workspace_id ON workspace_subscriptions(workspace_id);
CREATE INDEX idx_workspace_subscriptions_stripe_customer_id ON workspace_subscriptions(stripe_customer_id);
CREATE INDEX idx_workspace_subscriptions_status ON workspace_subscriptions(status);
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

### Modified Tables

#### `workspaces` - Add subscription status
```sql
ALTER TABLE workspaces
ADD COLUMN subscription_status TEXT DEFAULT 'inactive';
-- Values: inactive, active, trialing, past_due, canceled

-- Index for filtering by subscription status
CREATE INDEX idx_workspaces_subscription_status ON workspaces(subscription_status);
```

### Row Level Security (RLS) Policies

```sql
-- workspace_subscriptions: Only workspace owner can view
CREATE POLICY "Workspace owners can view subscription"
  ON workspace_subscriptions FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces
      WHERE created_by = auth.uid()
    )
  );

-- workspace_subscriptions: Only system can insert/update (via service role)
-- No public INSERT/UPDATE policies - only webhook API can modify

-- stripe_events: No public access (service role only)
```

---

## API Routes

### 1. `POST /api/stripe/create-checkout-session`
Creates a Stripe Checkout session for workspace subscription.

**Request Body:**
```typescript
{
  workspaceId: string; // UUID of workspace to subscribe
  priceId?: string;    // Optional for Phase 2 (tier selection)
}
```

**Flow:**
1. Verify user is workspace owner
2. Check if workspace already has active subscription
3. Get/create Stripe customer ID for user
4. Create Checkout session with:
   - Success URL: `/app/workspace/{id}?success=true`
   - Cancel URL: `/app/subscription?canceled=true`
   - Metadata: `{ workspace_id, user_id }`
5. Return checkout session URL

**Response:**
```typescript
{
  url: string; // Redirect user to this Stripe Checkout URL
}
```

---

### 2. `POST /api/stripe/webhook`
Handles Stripe webhook events.

**Webhook Events to Handle:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record, activate workspace |
| `customer.subscription.updated` | Update subscription status, period dates |
| `customer.subscription.deleted` | Mark subscription as canceled, deactivate workspace |
| `invoice.payment_succeeded` | Update payment status, extend period |
| `invoice.payment_failed` | Mark as past_due, send notification |

**Flow:**
1. Verify webhook signature (security)
2. Check if event already processed (idempotency)
3. Log event to `stripe_events` table
4. Handle event based on type
5. Update `workspace_subscriptions` and `workspaces` tables
6. Mark event as processed

**Important:**
- Use Supabase service role client (bypass RLS)
- Implement idempotency (check `stripe_event_id` before processing)
- Return 200 quickly (Stripe times out at 30s)

---

### 3. `POST /api/stripe/create-portal-session`
Creates a Stripe Customer Portal session for managing subscription.

**Request Body:**
```typescript
{
  workspaceId: string;
}
```

**Flow:**
1. Verify user is workspace owner
2. Get Stripe customer ID from workspace subscription
3. Create portal session
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

### 4. `GET /api/subscriptions/workspace/[workspaceId]`
Gets subscription details for a workspace.

**Response:**
```typescript
{
  workspaceId: string;
  status: 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled';
  planName?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;

  // Phase 2
  maxWorkspaces?: number;
  maxMembers?: number;
  currentWorkspaceCount?: number;
  currentMemberCount?: number;
}
```

---

## Stripe Setup

### 1. Stripe Dashboard Configuration

**Products:**
- **Phase 1:** Create 1 product: "StoryStack Pro"
  - Price: $149/month recurring
  - Note the `price_id` (e.g., `price_xxx`)

**Phase 2:** Add more prices to same product or create separate products

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

# Default price ID (Phase 1)
STRIPE_DEFAULT_PRICE_ID=price_xxx           # Your $149/mo price
```

---

## Frontend Components

### 1. Subscription Page (`/app/subscription/page.tsx`)
Replace placeholder with actual subscription UI.

**Features:**
- Show current subscription status
- List all owned workspaces with their subscription status
- "Subscribe" button per workspace → opens checkout
- "Manage Billing" button → opens Customer Portal

**Phase 1 UI:**
```
┌─────────────────────────────────────┐
│ StoryStack Pro - $149/month         │
│                                     │
│ Your Workspaces:                    │
│                                     │
│ • Brand Team Alpha [Active ✓]      │
│   └─ Manage Billing                │
│                                     │
│ • Marketing Assets [Not Subscribed] │
│   └─ Subscribe Now                 │
└─────────────────────────────────────┘
```

**Phase 2 UI:** Add plan cards with features, tier selection

---

### 2. Workspace Subscription Banner
Show banner in workspace if subscription is inactive or past_due.

**Location:** `/app/workspace/[id]` layout

**Banner Examples:**
- Inactive: "⚠️ This workspace needs a subscription. [Subscribe Now]"
- Past Due: "⚠️ Payment failed. Please update billing. [Manage Billing]"
- Trial: "🎉 Trial active until {date}. [Subscribe]"

---

### 3. Subscription Status Badge
Show subscription status in workspace switcher/header.

**UI:**
```
Brand Team Alpha [PRO ✓]
Marketing Assets [TRIAL]
Content Library [INACTIVE]
```

---

### 4. Checkout Flow Component
Reusable component to trigger Stripe Checkout.

**Props:**
```typescript
interface CheckoutButtonProps {
  workspaceId: string;
  priceId?: string; // Optional for Phase 2
  onSuccess?: () => void;
}
```

**Implementation:**
```typescript
const handleCheckout = async () => {
  const { url } = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ workspaceId, priceId })
  }).then(r => r.json());

  window.location.href = url; // Redirect to Stripe
};
```

---

## Implementation Steps

### Phase 1: Minimal Viable Subscription (Demo-Ready)

#### Step 1: Stripe Account Setup
- [ ] Create/configure Stripe account
- [ ] Create product: "StoryStack Pro" @ $149/mo
- [ ] Get API keys (test mode)
- [ ] Set up webhook endpoint
- [ ] Add environment variables

#### Step 2: Database Migration
- [ ] Create migration file: `supabase/migrations/[timestamp]_add_subscriptions.sql`
- [ ] Add `workspace_subscriptions` table
- [ ] Add `stripe_events` table
- [ ] Add `subscription_status` column to `workspaces`
- [ ] Add RLS policies
- [ ] Run migration

#### Step 3: Install Dependencies
```bash
npm install stripe @stripe/stripe-js
```

#### Step 4: Create Stripe Utilities
- [ ] `/apps/web/lib/stripe/server.ts` - Server-side Stripe client
- [ ] `/apps/web/lib/stripe/client.ts` - Client-side Stripe loader
- [ ] `/apps/web/lib/stripe/config.ts` - Shared config/types

#### Step 5: API Routes
- [ ] `/apps/web/app/api/stripe/create-checkout-session/route.ts`
- [ ] `/apps/web/app/api/stripe/webhook/route.ts`
- [ ] `/apps/web/app/api/stripe/create-portal-session/route.ts`
- [ ] `/apps/web/app/api/subscriptions/workspace/[workspaceId]/route.ts`

#### Step 6: Frontend Components
- [ ] Update `/apps/web/app/app/subscription/page.tsx`
- [ ] Create `SubscriptionButton` component
- [ ] Create `ManageBillingButton` component
- [ ] Add subscription status to workspace context/hooks

#### Step 7: Testing
- [ ] Test checkout flow (test mode)
- [ ] Test webhook handling (Stripe CLI)
- [ ] Test portal access
- [ ] Verify subscription status updates

#### Step 8: Production Deployment
- [ ] Switch to live Stripe keys
- [ ] Deploy webhook endpoint
- [ ] Test with real payment (refund after)

**Phase 1 Deliverables:**
✅ Working checkout flow
✅ Subscription status tracking
✅ Customer portal access
✅ Basic subscription page

---

### Phase 2: Tiered Pricing & Quota Enforcement

#### Step 1: Stripe Configuration
- [ ] Create additional price tiers ($250, $400)
- [ ] Enable plan switching in Customer Portal
- [ ] Configure proration settings

#### Step 2: Database Updates
- [ ] Add quota tracking queries
- [ ] Create view for user's total workspace/member counts
- [ ] Add quota validation functions

#### Step 3: Quota Enforcement Logic
- [ ] Before creating workspace: Check quota
- [ ] Before adding member: Check quota
- [ ] Show quota usage in UI
- [ ] Block actions when quota exceeded

#### Step 4: UI Enhancements
- [ ] Plan selection cards on subscription page
- [ ] Quota indicators (e.g., "2 / 10 members used")
- [ ] Upgrade prompts when approaching limits
- [ ] Plan comparison table

#### Step 5: Upgrade/Downgrade Flows
- [ ] API route for plan changes
- [ ] Handle proration
- [ ] Update webhook to handle plan changes
- [ ] UI for switching plans

---

## Key Technical Considerations

### Security
1. **Webhook Signature Verification:** Always verify `stripe-signature` header
2. **RLS Policies:** Only workspace owners can view subscription data
3. **API Authentication:** Verify Supabase session before checkout
4. **Customer ID Validation:** Ensure customer belongs to authenticated user

### Idempotency
- Store `stripe_event_id` before processing webhook
- Skip if already processed (prevents duplicate charges)

### Error Handling
- Graceful failures on checkout errors
- Retry logic for webhook processing
- User-friendly error messages
- Admin notifications for failed payments

### Performance
- Index `workspace_id`, `stripe_customer_id` for fast lookups
- Cache subscription status in workspace context
- React Query for subscription data fetching

### Testing Strategy
- **Local:** Stripe CLI for webhook testing (`stripe listen --forward-to`)
- **Test Mode:** Use Stripe test cards (4242 4242 4242 4242)
- **Production:** Small test transaction before going live

---

## File Structure

```
apps/web/
├── app/
│   ├── api/
│   │   └── stripe/
│   │       ├── create-checkout-session/
│   │       │   └── route.ts
│   │       ├── create-portal-session/
│   │       │   └── route.ts
│   │       └── webhook/
│   │           └── route.ts
│   │   └── subscriptions/
│   │       └── workspace/
│   │           └── [workspaceId]/
│   │               └── route.ts
│   └── app/
│       └── subscription/
│           └── page.tsx (update existing)
│
├── lib/
│   └── stripe/
│       ├── server.ts       # Server-side Stripe client
│       ├── client.ts       # Client-side Stripe loader
│       ├── config.ts       # Shared types/config
│       └── webhooks.ts     # Webhook handlers
│
├── components/
│   └── subscription/
│       ├── SubscriptionButton.tsx
│       ├── ManageBillingButton.tsx
│       ├── SubscriptionBanner.tsx
│       └── SubscriptionStatusBadge.tsx
│
└── types/
    └── subscription.ts     # TypeScript types

supabase/
└── migrations/
    └── [timestamp]_add_subscriptions.sql
```

---

## Success Criteria

### Phase 1
- [ ] User can subscribe to workspace via Stripe Checkout
- [ ] Subscription status updates via webhooks
- [ ] User can manage billing via Customer Portal
- [ ] Subscription page shows status for all owned workspaces
- [ ] Basic subscription enforcement (show banners for inactive workspaces)

### Phase 2
- [ ] Multiple pricing tiers available
- [ ] Quota enforcement (workspace count, member limits)
- [ ] Upgrade/downgrade between plans
- [ ] Quota usage displayed in UI
- [ ] Blocking when quota exceeded

---

## Timeline Estimate

**Phase 1 (Demo-Ready):**
- Setup & Configuration: 1-2 hours
- Database Schema: 1 hour
- API Routes: 3-4 hours
- Frontend Components: 2-3 hours
- Testing: 2-3 hours
- **Total: 1-2 days**

**Phase 2 (Full Tiered System):**
- Stripe Configuration: 1 hour
- Quota Logic: 3-4 hours
- UI Enhancements: 3-4 hours
- Testing: 2-3 hours
- **Total: 1-2 days**

---

## Next Steps

1. Review this plan
2. Set up Stripe account and get API keys
3. Begin Phase 1 implementation
4. Test with demo customers
5. Launch Phase 1 for revenue
6. Gather feedback
7. Implement Phase 2 when ready to scale pricing

---

## Questions to Resolve

1. **Trial Period:** Should new workspaces get a free trial? (e.g., 14 days)
2. **Grandfathering:** What happens to existing workspaces when Phase 2 launches?
3. **Failed Payments:** How many retry attempts? When to disable workspace access?
4. **Cancellation Policy:** Immediate or end of period?
5. **Refund Policy:** Prorated refunds on cancellation?
6. **Tax Handling:** Enable Stripe Tax for automatic tax calculation?

---

## Resources

- [Stripe Subscriptions Docs](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase Service Role](https://supabase.com/docs/guides/auth/service-role-key)
