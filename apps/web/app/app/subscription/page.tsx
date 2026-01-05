'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MobileMenuButton } from '@/components/app/MobileMenuButton';
import {
  useSubscriptionInfo,
  useCreateCheckoutSession,
  useChangePlan,
  useCancelSubscription,
  useReactivateSubscription,
  useCreateSetupIntent,
  useUpdatePaymentMethod,
} from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BillingInterval } from '@/lib/stripe/config';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Layers,
  Users,
  Sparkles,
  FolderOpen,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const PRICING = {
  monthly: 149,
  annual: 1490,
};

export default function SubscriptionPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');

  const {
    subscription,
    paymentMethod,
    hasActiveSubscription,
    isTrialing,
    isCanceled,
    workspaceUsage,
    memberUsage,
    isLoading,
    refetch,
  } = useSubscriptionInfo();

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center gap-3 pb-4">
            <MobileMenuButton />
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                Billing
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Manage your plan and payment details
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
          {/* Success message - subtle */}
          {success && (
            <div className="mb-6 text-sm text-gray-600">
              Payment confirmed. Welcome to StoryStack Pro.
            </div>
          )}

          {isLoading ? (
            <LoadingState />
          ) : hasActiveSubscription ? (
            <ActiveSubscriptionView
              subscription={subscription!}
              paymentMethod={paymentMethod}
              workspaceUsage={workspaceUsage}
              memberUsage={memberUsage}
              isTrialing={isTrialing}
              isCanceled={isCanceled}
              onRefresh={refetch}
            />
          ) : (
            <NoSubscriptionView
              hadPreviousSubscription={subscription?.status === 'canceled' || subscription?.status === 'unpaid' || subscription?.status === 'inactive'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
      <p className="text-sm text-gray-500 mt-3">Loading billing details...</p>
    </div>
  );
}

// ============================================
// ACTIVE SUBSCRIPTION VIEW
// ============================================
function ActiveSubscriptionView({
  subscription,
  paymentMethod,
  workspaceUsage,
  memberUsage,
  isTrialing,
  isCanceled,
  onRefresh,
}: any) {
  const [showCancelView, setShowCancelView] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const changePlan = useChangePlan();
  const cancelSubscription = useCancelSubscription();
  const reactivateSubscription = useReactivateSubscription();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleChangePlan = async (newInterval: BillingInterval) => {
    try {
      await changePlan.mutateAsync(newInterval);
      showSuccess('Plan updated');
      setTimeout(() => onRefresh(), 1500);
    } catch (error) {}
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscription.mutateAsync();
      setShowCancelView(false);
      showSuccess('Subscription canceled');
      setTimeout(() => onRefresh(), 1500);
    } catch (error) {}
  };

  const handleReactivate = async () => {
    try {
      await reactivateSubscription.mutateAsync();
      showSuccess('Subscription reactivated');
      setTimeout(() => onRefresh(), 1500);
    } catch (error) {}
  };

  const handlePaymentUpdated = () => {
    setShowPaymentForm(false);
    showSuccess('Payment method updated');
    onRefresh();
  };

  const currentInterval = subscription.billingInterval as BillingInterval;
  const isAnnual = currentInterval === 'year';
  const newInterval: BillingInterval = isAnnual ? 'month' : 'year';

  // Render cancellation view
  if (showCancelView) {
    return (
      <CancellationView
        subscription={subscription}
        formatDate={formatDate}
        onBack={() => setShowCancelView(false)}
        onConfirmCancel={handleCancelSubscription}
        isCanceling={cancelSubscription.isPending}
      />
    );
  }

  // Default: Overview
  return (
    <div className="space-y-8">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-accent text-white text-sm rounded-lg shadow-elevated">
          <Check className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {/* Cancellation Notice */}
      {isCanceled && subscription.currentPeriodEnd && (
        <div className="bg-white rounded-2xl border border-accent/20 shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-accent/5">
            <p className="text-gray-900 font-medium">
              Your plan ends {formatDate(subscription.currentPeriodEnd)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Reactivate to keep your workspaces and team access.
            </p>
            <Button
              className="mt-4 h-11 px-6 bg-accent hover:bg-accent/90"
              onClick={handleReactivate}
              disabled={reactivateSubscription.isPending}
            >
              {reactivateSubscription.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reactivating...
                </>
              ) : (
                'Reactivate plan'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* SECTION 1: Your Plan */}
      {/* ============================================ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900">StoryStack Pro</h2>
                {isTrialing && (
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    Trial
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {isAnnual ? 'Annual plan' : 'Monthly plan'}
                {isTrialing && subscription.trialEnd ? (
                  <span> · First charge {formatDate(subscription.trialEnd)}</span>
                ) : subscription.currentPeriodEnd && !isCanceled ? (
                  <span> · Renews {formatDate(subscription.currentPeriodEnd)}</span>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        {/* Payment method row */}
        <button
          onClick={() => setShowPaymentForm(true)}
          className="w-full px-8 py-5 flex items-center justify-between text-left group hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            {paymentMethod ? (
              <>
                <div className="w-12 h-8 bg-gradient-to-br from-accent to-amber-700 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-medium uppercase">
                    {paymentMethod.brand.slice(0, 4)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    •••• {paymentMethod.last4}
                  </p>
                  <p className="text-xs text-gray-500">
                    Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Add payment method</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-accent transition-colors" />
        </button>
      </div>

      {/* ============================================ */}
      {/* SECTION 1b: Billing Cycle */}
      {/* ============================================ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Billing cycle</h2>
          <p className="text-sm text-gray-500 mt-1">
            Currently on {isAnnual ? 'annual' : 'monthly'} billing
          </p>
        </div>
        <div className="px-8 py-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isAnnual ? '$1,490/year' : '$149/month'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isAnnual
                  ? 'Equivalent to $124/month'
                  : 'Switch to annual and save 17%'}
              </p>
            </div>
            {!isCanceled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleChangePlan(newInterval)}
                disabled={changePlan.isPending}
              >
                {changePlan.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Switch to ${newInterval === 'year' ? 'annual' : 'monthly'}`
                )}
              </Button>
            )}
          </div>
          {/* Annual upgrade incentive - only show for monthly users */}
          {!isAnnual && !isCanceled && (
            <p className="mt-3 text-xs text-accent">
              Save $298/year — that's 2 months free
            </p>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 2: Capacity */}
      {/* ============================================ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Capacity</h2>
          <p className="text-sm text-gray-500 mt-1">Resources across workspaces you own</p>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Workspaces */}
          <div className="px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Workspaces</p>
                  <p className="text-xs text-gray-500">
                    {workspaceUsage.limit - workspaceUsage.current} available
                  </p>
                </div>
              </div>
              <span className="text-sm text-gray-500">
                {workspaceUsage.current} of {workspaceUsage.limit}
              </span>
            </div>
            <div className="mt-3 h-1.5 bg-accent/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.max(workspaceUsage.percentage, 2)}%` }}
              />
            </div>
          </div>

          {/* Team members */}
          <div className="px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Team members</p>
                  <p className="text-xs text-gray-500">
                    {memberUsage.limit - memberUsage.current} seats available
                  </p>
                </div>
              </div>
              <span className="text-sm text-gray-500">
                {memberUsage.current} of {memberUsage.limit}
              </span>
            </div>
            <div className="mt-3 h-1.5 bg-accent/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.max(memberUsage.percentage, 2)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 3: Pro Features */}
      {/* ============================================ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">What's included</h2>
          <p className="text-sm text-gray-500 mt-1">Your Pro plan features</p>
        </div>
        <div className="px-8 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FeatureItem
              icon={<FolderOpen className="w-5 h-5" />}
              title="Organize stories"
              description="Up to 10 workspaces with unlimited assets"
            />
            <FeatureItem
              icon={<Users className="w-5 h-5" />}
              title="Collaborate visually"
              description="Invite up to 50 team members"
            />
            <FeatureItem
              icon={<Sparkles className="w-5 h-5" />}
              title="AI-powered tagging"
              description="Smart organization and search"
            />
            <FeatureItem
              icon={<Layers className="w-5 h-5" />}
              title="Scale your library"
              description="No storage limits on assets"
            />
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 4: Cancel (collapsed) */}
      {/* ============================================ */}
      {!isCanceled && (
        <div className="pt-4">
          <button
            onClick={() => setShowCancelView(true)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel subscription
          </button>
        </div>
      )}

      {/* ============================================ */}
      {/* Payment Method Dialog */}
      {/* ============================================ */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Update payment method</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your new card details</p>
            </div>
            <Elements stripe={stripePromise}>
              <PaymentMethodForm
                onSuccess={handlePaymentUpdated}
                onCancel={() => setShowPaymentForm(false)}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ============================================
// PAYMENT METHOD FORM
// ============================================
function PaymentMethodForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSetupIntent = useCreateSetupIntent();
  const updatePaymentMethod = useUpdatePaymentMethod();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);
    setError(null);

    try {
      const { clientSecret } = await createSetupIntent.mutateAsync();
      const cardElement = elements.getElement(CardElement);

      if (!cardElement) throw new Error('Card element not found');

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeError) throw new Error(stripeError.message);
      if (!setupIntent?.payment_method) throw new Error('Failed to set up payment method');

      await updatePaymentMethod.mutateAsync(setupIntent.payment_method as string);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment method');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#111827',
                '::placeholder': { color: '#9ca3af' },
              },
            },
          }}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="h-11">
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isLoading} className="h-11">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save card'
          )}
        </Button>
      </div>
    </form>
  );
}

// ============================================
// CANCELLATION VIEW
// ============================================
function CancellationView({
  subscription,
  formatDate,
  onBack,
  onConfirmCancel,
  isCanceling,
}: any) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const canConfirm = confirmText.toLowerCase() === 'cancel';

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to overview
      </button>

      {/* Cancel Info */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Cancel subscription</h2>
          <p className="text-sm text-gray-500 mt-1">
            We're sorry to see you go
          </p>
        </div>
        <div className="px-8 py-6 space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              If you cancel, your subscription will remain active until{' '}
              <span className="font-medium text-gray-900">
                {subscription.currentPeriodEnd && formatDate(subscription.currentPeriodEnd)}
              </span>
              . After that date:
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-1">·</span>
                All your workspaces will become read-only
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-1">·</span>
                You can still view and download your assets
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-1">·</span>
                Uploads, edits, and invites will be disabled until you resubscribe
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              className="text-gray-600 hover:text-red-600 hover:border-red-200"
              onClick={() => setShowConfirmDialog(true)}
            >
              Continue to cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm cancellation</AlertDialogTitle>
            <AlertDialogDescription>
              Type "cancel" to confirm. You can reactivate anytime before your billing period ends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type 'cancel' to confirm"
              className="h-11"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my plan</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmCancel}
              disabled={!canConfirm || isCanceling}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isCanceling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Cancel subscription'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// NO SUBSCRIPTION VIEW (Upgrade)
// ============================================
function NoSubscriptionView({ hadPreviousSubscription }: { hadPreviousSubscription?: boolean }) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('year');
  const createCheckoutSession = useCreateCheckoutSession();

  const handleSubscribe = () => {
    // Skip trial for returning users who already had a subscription
    createCheckoutSession.mutate({
      interval: billingInterval,
      skipTrial: hadPreviousSubscription,
    });
  };

  const monthlyEquivalent = billingInterval === 'year' ? Math.round(PRICING.annual / 12) : PRICING.monthly;
  const savings = PRICING.monthly * 12 - PRICING.annual;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {hadPreviousSubscription ? 'Subscribe to StoryStack Pro' : 'Start your 14-day free trial'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {hadPreviousSubscription
              ? 'Restore full access to your workspaces.'
              : 'Full access to all Pro features. Cancel anytime.'}
          </p>
        </div>
        <div className="px-8 py-8">
          {/* Toggle */}
          <div className="flex items-center justify-center gap-1 p-1 bg-gray-100 rounded-lg w-fit mx-auto mb-8">
            <button
              onClick={() => setBillingInterval('month')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                billingInterval === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('year')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                billingInterval === 'year'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Annual
              <span className="ml-1.5 text-accent">-17%</span>
            </button>
          </div>

          {/* Price */}
          <div className="text-center mb-8">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-semibold text-gray-900">${monthlyEquivalent}</span>
              <span className="text-gray-500">/month</span>
            </div>
            {billingInterval === 'year' ? (
              <p className="mt-2 text-sm text-gray-500">
                ${PRICING.annual} billed annually · Save ${savings}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                {hadPreviousSubscription ? 'Billed monthly' : 'Billed monthly after trial'}
              </p>
            )}
          </div>

          {/* Features */}
          <ul className="space-y-3 mb-8 max-w-sm mx-auto">
            {[
              '10 workspaces',
              '50 team members',
              'AI-powered organization',
              'Unlimited assets',
              'Priority support',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-gray-700">
                <Check className="w-4 h-4 text-accent flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Button
            size="lg"
            className="w-full h-12 text-base bg-accent hover:bg-accent/90"
            onClick={handleSubscribe}
            disabled={createCheckoutSession.isPending}
          >
            {createCheckoutSession.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {hadPreviousSubscription ? 'Subscribing...' : 'Starting trial...'}
              </>
            ) : hadPreviousSubscription ? (
              'Subscribe now'
            ) : (
              'Start free trial'
            )}
          </Button>

          {/* Trial note - only show for new users */}
          {!hadPreviousSubscription && (
            <p className="mt-4 text-center text-xs text-gray-500">
              Add a card to start. You won't be charged until day 15.
            </p>
          )}

          {createCheckoutSession.isError && (
            <p className="mt-3 text-sm text-red-600 text-center">
              {createCheckoutSession.error?.message || 'Something went wrong'}
            </p>
          )}
        </div>
      </div>

      {/* Current status note */}
      <p className="text-center text-sm text-gray-400">
        A subscription is required to upload and edit assets
      </p>
    </div>
  );
}
