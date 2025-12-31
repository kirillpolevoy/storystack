/**
 * Stripe configuration and shared types
 */

export type BillingInterval = 'month' | 'year';

export type SubscriptionStatus =
  | 'inactive'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

/**
 * Stripe webhook events we handle
 */
export const STRIPE_WEBHOOK_EVENTS = {
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
} as const;

/**
 * Map Stripe subscription status to our status
 */
export function mapStripeStatus(
  stripeStatus: string
): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
    case 'incomplete_expired':
      return 'inactive';
    default:
      return 'inactive';
  }
}

/**
 * Pricing configuration
 * Phase 1: Single generous quota for all customers
 */
export const DEFAULT_QUOTA = {
  max_workspaces: 10,
  max_members: 50,
} as const;

/**
 * Free tier limits (no subscription)
 */
export const FREE_TIER_LIMITS = {
  max_workspaces: 1,
  max_members: 3,
} as const;
