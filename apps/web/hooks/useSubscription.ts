import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubscriptionStatusResponse, CreateCheckoutSessionRequest, QuotaCheckResponse } from '@/types/subscription';
import { BillingInterval } from '@/lib/stripe/config';

/**
 * Hook to fetch and manage user subscription data
 */
export function useSubscription() {
  return useQuery<SubscriptionStatusResponse>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions/status');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to check quota for specific actions
 */
export function useQuotaCheck(action: 'create_workspace' | 'add_member') {
  return useQuery<QuotaCheckResponse>({
    queryKey: ['quota-check', action],
    queryFn: async () => {
      const response = await fetch(`/api/subscriptions/check-quota?action=${action}`);
      if (!response.ok) {
        throw new Error('Failed to check quota');
      }
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to create a Stripe checkout session
 */
export function useCreateCheckoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateCheckoutSessionRequest) => {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

/**
 * Hook to create a Stripe Customer Portal session
 */
export function useCreatePortalSession() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create portal session');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

/**
 * Helper hook to get formatted subscription info
 */
export function useSubscriptionInfo() {
  const { data, isLoading, error, refetch } = useSubscription();

  const hasActiveSubscription = data?.subscription?.status === 'active' || data?.subscription?.status === 'trialing';
  const isTrialing = data?.subscription?.status === 'trialing';
  const isPastDue = data?.subscription?.status === 'past_due';
  const isCanceled = data?.subscription?.cancelAtPeriodEnd === true;

  const workspaceUsage = {
    current: data?.usage?.workspaceCount || 0,
    limit: data?.subscription?.maxWorkspaces || 1,
    percentage: data?.subscription?.maxWorkspaces
      ? Math.round(((data?.usage?.workspaceCount || 0) / data.subscription.maxWorkspaces) * 100)
      : 0,
  };

  const memberUsage = {
    current: data?.usage?.memberCount || 0,
    limit: data?.subscription?.maxMembers || 3,
    percentage: data?.subscription?.maxMembers
      ? Math.round(((data?.usage?.memberCount || 0) / data.subscription.maxMembers) * 100)
      : 0,
  };

  return {
    subscription: data?.subscription,
    paymentMethod: data?.paymentMethod,
    usage: data?.usage,
    canCreateWorkspace: data?.canCreateWorkspace ?? false,
    canAddMember: data?.canAddMember ?? false,
    hasActiveSubscription,
    isTrialing,
    isPastDue,
    isCanceled,
    workspaceUsage,
    memberUsage,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to change subscription plan (monthly <-> annual)
 */
export function useChangePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interval: BillingInterval) => {
      const response = await fetch('/api/stripe/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_plan', interval }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to change plan');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Hook to cancel subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel subscription');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Hook to reactivate a canceled subscription
 */
export function useReactivateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reactivate subscription');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * Hook to create a setup intent for updating payment method
 */
export function useCreateSetupIntent() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create setup intent');
      }

      return response.json();
    },
  });
}

/**
 * Hook to update payment method
 */
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await fetch('/api/stripe/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update payment method');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}
