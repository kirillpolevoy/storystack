# Stripe Integration - Next Steps

## ✅ What's Been Completed

Phase 1 implementation is complete! Here's what's been built:

### Database ✅
- `user_subscriptions` table with billing interval support
- `stripe_events` table for webhook logging
- Quota checking functions (`get_user_workspace_count`, `get_user_total_member_count`)
- RLS policies for secure access
- Database migration file: `supabase/migrations/20251231034330_add_user_subscriptions.sql`

### Backend ✅
- 5 API routes fully implemented
- Stripe webhook handler with signature verification
- Customer portal integration
- Subscription status and quota checking endpoints

### Frontend ✅
- Complete subscription page with active/inactive states
- Monthly/Annual billing toggle component
- Subscribe and Manage Billing buttons
- Usage meters for workspaces and members
- React Query hooks for data fetching

---

## 🚀 Required Setup Steps

### 1. Stripe Account Setup

**Actions Required:**

1. **Create/Login to Stripe Account**
   - Go to https://dashboard.stripe.com/
   - Create account or login

2. **Create Product & Prices**
   - Navigate to Products → Create Product
   - Product name: "StoryStack Pro"
   - Create **2 prices**:

   **Monthly Price:**
   - Amount: $149
   - Billing period: Monthly
   - Click "Add metadata":
     - Key: `max_workspaces`, Value: `10`
     - Key: `max_members`, Value: `50`
   - Copy the `price_id` (starts with `price_`)

   **Annual Price:**
   - Amount: $1,490
   - Billing period: Yearly
   - Click "Add metadata":
     - Key: `max_workspaces`, Value: `10`
     - Key: `max_members`, Value: `50`
   - Copy the `price_id` (starts with `price_`)

3. **Get API Keys**
   - Go to Developers → API keys
   - Copy **Publishable key** (starts with `pk_test_`)
   - Copy **Secret key** (starts with `sk_test_`)
   - ⚠️ Keep secret key private!

4. **Configure Webhook** (after deploying to a public URL)
   - Go to Developers → Webhooks → Add endpoint
   - Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
   - Select events to listen to:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy **Signing secret** (starts with `whsec_`)

5. **Enable Customer Portal**
   - Go to Settings → Billing → Customer portal
   - Turn ON customer portal
   - Configure settings:
     - ✅ Allow customers to update payment methods
     - ✅ Allow customers to view invoices
     - ✅ Allow customers to cancel subscriptions
     - ✅ Allow customers to switch plans (for Phase 2)

---

### 2. Environment Variables

**Add to `.env.local` (or your environment):**

```bash
# Stripe Keys (from Step 1.3)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx

# Stripe Webhook Secret (from Step 1.4)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# Price IDs (from Step 1.2)
STRIPE_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxxxxx
STRIPE_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxxxxx

# Supabase Service Role Key (for webhook API)
# Get from: Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important Security Notes:**
- Never commit `.env.local` to git
- Add `.env.local` to `.gitignore`
- Only `NEXT_PUBLIC_*` variables are exposed to the browser
- `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only

---

### 3. Database Migration

**Run the migration to create tables:**

```bash
# Option 1: Using Supabase CLI (recommended)
npx supabase db push

# Option 2: Apply migration manually
# Go to Supabase Dashboard → SQL Editor
# Copy contents of: supabase/migrations/20251231034330_add_user_subscriptions.sql
# Paste and run
```

**Verify migration success:**
```sql
-- Run in Supabase SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_subscriptions', 'stripe_events');

-- Should return both tables
```

---

### 4. Local Testing

**Test the integration locally:**

1. **Install Stripe CLI** (for webhook testing)
   ```bash
   brew install stripe/stripe-cli/stripe
   # or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe CLI**
   ```bash
   stripe login
   ```

3. **Start your dev server**
   ```bash
   cd apps/web
   npm run dev
   ```

4. **Forward webhooks to localhost** (in another terminal)
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   This will output a webhook signing secret like:
   ```
   whsec_xxxxxxxxxxxxx
   ```

   **Update `.env.local` with this local webhook secret** for testing

5. **Test the subscription flow**
   - Navigate to http://localhost:3000/app/subscription
   - Click "Subscribe" and choose monthly or annual
   - Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: any future date (e.g., 12/34)
   - CVC: any 3 digits (e.g., 123)

6. **Verify webhook processing**
   - Check terminal running `stripe listen` for webhook events
   - Check Supabase `stripe_events` table for logged events
   - Check `user_subscriptions` table for your subscription

7. **Test Customer Portal**
   - After subscribing, click "Manage Billing"
   - Verify you can update payment method, view invoices, cancel subscription

---

### 5. Production Deployment

**Before deploying:**

1. **Switch to Live Stripe Keys**
   - In Stripe Dashboard, toggle from "Test mode" to "Live mode"
   - Get new live API keys (starts with `pk_live_` and `sk_live_`)
   - Create live prices (same as test, but in live mode)
   - Get live webhook signing secret
   - Update production environment variables

2. **Deploy to Production**
   ```bash
   # Example with Vercel
   vercel --prod

   # Or your deployment platform
   ```

3. **Configure Production Webhook**
   - Go to Stripe Dashboard (Live mode) → Webhooks
   - Add endpoint with your production URL
   - Select same events as step 1.4
   - Copy signing secret and update production env vars

4. **Test with Real Payment**
   - Use a real card with small amount
   - Complete full subscription flow
   - Verify webhooks are processed
   - Immediately cancel and refund for testing

---

## 📋 Testing Checklist

### Functionality Tests

- [ ] User can view subscription page
- [ ] User can toggle between monthly/annual pricing
- [ ] User can click Subscribe and reach Stripe Checkout
- [ ] Test card completes subscription successfully
- [ ] Webhook processes `checkout.session.completed`
- [ ] Subscription appears in database (`user_subscriptions`)
- [ ] Subscription page shows "Active" status
- [ ] Usage meters display correctly (workspaces, members)
- [ ] User can click "Manage Billing" and access Customer Portal
- [ ] User can update payment method in portal
- [ ] User can cancel subscription in portal
- [ ] Canceled subscription shows correct end date
- [ ] Quota functions return correct counts
- [ ] `/api/subscriptions/status` returns correct data
- [ ] `/api/subscriptions/check-quota` validates correctly

### Edge Cases

- [ ] User with no subscription sees signup page
- [ ] User with active subscription sees usage stats
- [ ] User with canceled subscription shows warning banner
- [ ] Past due payment shows error banner
- [ ] Trying to subscribe twice is prevented
- [ ] Webhook events are idempotent (don't process twice)
- [ ] Invalid webhook signatures are rejected
- [ ] Free tier limits are enforced (1 workspace, 3 members)

### Security

- [ ] RLS policies prevent users from viewing other's subscriptions
- [ ] Webhook signature verification works
- [ ] Service role key is NOT exposed to client
- [ ] Stripe secret key is NOT exposed to client
- [ ] API routes verify user authentication

---

## 🔧 Common Issues & Solutions

### Issue: Webhook signature verification fails

**Solution:**
- Make sure `STRIPE_WEBHOOK_SECRET` matches your endpoint
- For local testing, use the secret from `stripe listen` output
- For production, use the secret from Stripe Dashboard webhook settings

### Issue: `SUPABASE_SERVICE_ROLE_KEY` not found

**Solution:**
1. Go to Supabase Dashboard
2. Settings → API
3. Copy `service_role` key (not `anon` key!)
4. Add to `.env.local`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

### Issue: Database functions not found

**Solution:**
- Run the migration: `npx supabase db push`
- Or manually execute SQL from `supabase/migrations/20251231034330_add_user_subscriptions.sql`

### Issue: Subscription not appearing after payment

**Solution:**
1. Check webhook logs in `stripe_events` table
2. Look for errors in `error_message` column
3. Check Stripe Dashboard → Webhooks → Event logs for failed events
4. Verify `user_id` is in checkout session metadata

### Issue: "Cannot read properties of undefined"

**Solution:**
- Make sure React Query provider is wrapping your app
- Check that `apps/web/app/providers.tsx` includes QueryClientProvider
- Verify all components are inside `<Providers>` wrapper

---

## 📊 Monitoring & Maintenance

### What to Monitor

1. **Stripe Dashboard**
   - Failed payments
   - Webhook delivery success rate
   - Subscription churn rate
   - MRR (Monthly Recurring Revenue)

2. **Database**
   - `stripe_events` table for processing errors
   - `user_subscriptions` for status anomalies
   - Quota usage trends

3. **Logs**
   - API route errors (check your hosting platform logs)
   - Webhook processing failures
   - Customer support tickets related to billing

### Recommended Alerts

- Failed webhook deliveries (Stripe → Email notifications)
- Past due payments > 7 days
- Unusual spikes in cancellations
- Webhook processing errors

---

## 🎯 Future Enhancements (Phase 2)

When ready to scale, you can add:

### Tiered Pricing
- Create additional products/prices in Stripe:
  - Tier 1: $149/mo → 1 workspace, 10 members
  - Tier 2: $250/mo → 2 workspaces, 20 members
  - Tier 3: $400/mo → 4 workspaces, 40 members

### Quota Enforcement
- Update database functions to strictly enforce limits
- Add UI blocking when quota exceeded
- Add upgrade prompts at 80% usage

### Workspace Creation Checks
- Integrate `can_user_create_workspace()` check
- Show upgrade modal when limit reached
- See STRIPE_IMPLEMENTATION_PLAN.md for details

### Analytics
- Track subscription conversion rates
- Monitor upgrade/downgrade patterns
- Identify popular pricing tiers

---

## 📚 Additional Resources

- [Stripe Subscriptions Documentation](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- Full implementation plan: `STRIPE_IMPLEMENTATION_PLAN.md`

---

## 🆘 Need Help?

If you encounter issues:

1. Check the **Common Issues** section above
2. Review Stripe Dashboard logs
3. Check `stripe_events` table for webhook errors
4. Review implementation plan: `STRIPE_IMPLEMENTATION_PLAN.md`
5. Test with `stripe listen --forward-to` for local debugging

---

## ✅ Ready to Go Live?

Before launching:

1. ✅ Complete all steps in "Required Setup"
2. ✅ Run through testing checklist
3. ✅ Test with real payment in Stripe test mode
4. ✅ Switch to live Stripe keys
5. ✅ Configure production webhook
6. ✅ Make small real payment to test
7. ✅ Monitor for 24 hours before announcing

**You're ready to start charging customers! 🎉**
