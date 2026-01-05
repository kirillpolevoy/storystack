import { BillingInterval, SubscriptionStatus } from '@/lib/stripe/config';

/**
 * User subscription from database
 */
export interface UserSubscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: SubscriptionStatus;
  plan_name: string | null;
  billing_interval: BillingInterval | null;
  max_workspaces: number;
  max_members: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Payment method info from Stripe
 */
export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/**
 * Subscription status response from API
 */
export interface SubscriptionStatusResponse {
  subscription: {
    status: SubscriptionStatus;
    planName: string | null;
    billingInterval: BillingInterval | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    maxWorkspaces: number;
    maxMembers: number;
    trialEnd: string | null;
  } | null;
  paymentMethod: PaymentMethodInfo | null;
  usage: {
    workspaceCount: number;
    memberCount: number;
  };
  canCreateWorkspace: boolean;
  canAddMember: boolean;
}

/**
 * Quota check response from API
 */
export interface QuotaCheckResponse {
  allowed: boolean;
  reason?: 'quota_exceeded' | 'no_subscription' | 'subscription_inactive';
  current: number;
  limit: number;
}

/**
 * Create checkout session request
 */
export interface CreateCheckoutSessionRequest {
  interval: BillingInterval;
  priceId?: string; // Optional for Phase 2
  skipTrial?: boolean; // Skip trial for returning users who already had a subscription
}

/**
 * Create checkout session response
 */
export interface CreateCheckoutSessionResponse {
  url: string;
}

/**
 * Create portal session response
 */
export interface CreatePortalSessionResponse {
  url: string;
}
