'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MobileMenuButton } from '@/components/app/MobileMenuButton';
import { useSubscriptionInfo } from '@/hooks/useSubscription';
import { SubscribeButton } from '@/components/subscription/SubscribeButton';
import { ManageBillingButton } from '@/components/subscription/ManageBillingButton';

export default function SubscriptionPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const {
    subscription,
    usage,
    hasActiveSubscription,
    isTrialing,
    isPastDue,
    isCanceled,
    workspaceUsage,
    memberUsage,
    isLoading,
  } = useSubscriptionInfo();

  useEffect(() => {
    if (success) {
      // Show success message
      console.log('Subscription successful!');
    }
    if (canceled) {
      // Show canceled message
      console.log('Subscription canceled');
    }
  }, [success, canceled]);

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 pb-4">
            <div className="flex items-center gap-3">
              <MobileMenuButton />
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                Subscription
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-12">
        <div className="max-w-4xl mx-auto">
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-6 rounded-lg bg-accent/10 border border-accent/20 p-4">
              <p className="text-sm text-accent">
                Successfully subscribed! Your subscription is now active.
              </p>
            </div>
          )}

          {canceled && (
            <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
              <p className="text-sm text-yellow-800">
                Subscription checkout was canceled. You can try again anytime.
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
            </div>
          ) : hasActiveSubscription ? (
            <ActiveSubscriptionView
              subscription={subscription!}
              workspaceUsage={workspaceUsage}
              memberUsage={memberUsage}
              isTrialing={isTrialing}
              isPastDue={isPastDue}
              isCanceled={isCanceled}
            />
          ) : (
            <NoSubscriptionView />
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveSubscriptionView({
  subscription,
  workspaceUsage,
  memberUsage,
  isTrialing,
  isPastDue,
  isCanceled,
}: any) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {isPastDue && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">
            Payment failed. Please update your billing information to continue using StoryStack.
          </p>
        </div>
      )}

      {isTrialing && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-800">
            You're currently on a trial. Your first payment will be charged on{' '}
            {subscription.currentPeriodEnd && formatDate(subscription.currentPeriodEnd)}.
          </p>
        </div>
      )}

      {isCanceled && subscription.currentPeriodEnd && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm text-yellow-800">
            Your subscription has been canceled and will end on{' '}
            {formatDate(subscription.currentPeriodEnd)}.
          </p>
        </div>
      )}

      {/* Subscription Details Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {subscription.planName || 'StoryStack Pro'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {subscription.billingInterval === 'year' ? 'Billed annually' : 'Billed monthly'}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {isTrialing ? 'Trial' : 'Active'}
          </span>
        </div>

        {subscription.currentPeriodEnd && (
          <p className="text-sm text-gray-600 mb-4">
            Next billing date: {formatDate(subscription.currentPeriodEnd)}
          </p>
        )}

        <ManageBillingButton className="w-full sm:w-auto" />
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Workspaces Usage */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Workspaces</h3>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-semibold text-gray-900">
              {workspaceUsage.current}
            </span>
            <span className="text-sm text-gray-600">/ {workspaceUsage.limit}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full ${
                workspaceUsage.percentage >= 100
                  ? 'bg-red-600'
                  : workspaceUsage.percentage >= 80
                  ? 'bg-yellow-600'
                  : 'bg-accent'
              }`}
              style={{ width: `${Math.min(workspaceUsage.percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Members Usage */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Team Members</h3>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-semibold text-gray-900">
              {memberUsage.current}
            </span>
            <span className="text-sm text-gray-600">/ {memberUsage.limit}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full ${
                memberUsage.percentage >= 100
                  ? 'bg-red-600'
                  : memberUsage.percentage >= 80
                  ? 'bg-yellow-600'
                  : 'bg-accent'
              }`}
              style={{ width: `${Math.min(memberUsage.percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">What's included</h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-accent mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm text-gray-700">
              Up to {subscription.maxWorkspaces} workspaces
            </span>
          </li>
          <li className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-accent mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm text-gray-700">
              Up to {subscription.maxMembers} team members
            </span>
          </li>
          <li className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-accent mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm text-gray-700">AI-powered asset organization</span>
          </li>
          <li className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-accent mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm text-gray-700">Unlimited assets and stories</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function NoSubscriptionView() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-[-0.02em] mb-4">
          Choose your plan
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Unlock team collaboration and scale your content operations with StoryStack Pro
        </p>
      </div>

      {/* Pricing Card */}
      <div className="max-w-md mx-auto">
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-sm">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">StoryStack Pro</h3>
            <p className="text-gray-600">Everything you need to manage your brand assets</p>
          </div>

          <SubscribeButton showBillingToggle={true} />

          <ul className="mt-8 space-y-4">
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-accent mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-gray-700">Up to 10 workspaces</span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-accent mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-gray-700">Up to 50 team members</span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-accent mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-gray-700">AI-powered organization</span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-accent mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-gray-700">Unlimited assets & stories</span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-accent mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-gray-700">Priority support</span>
            </li>
          </ul>
        </div>
      </div>

      {/* FAQ/Info Section */}
      <div className="max-w-2xl mx-auto mt-12">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
          Frequently asked questions
        </h3>
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h4 className="font-medium text-gray-900 mb-2">Can I cancel anytime?</h4>
            <p className="text-sm text-gray-600">
              Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h4 className="font-medium text-gray-900 mb-2">What payment methods do you accept?</h4>
            <p className="text-sm text-gray-600">
              We accept all major credit cards (Visa, Mastercard, American Express) through Stripe.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h4 className="font-medium text-gray-900 mb-2">Is there a free trial?</h4>
            <p className="text-sm text-gray-600">
              You can use StoryStack with 1 free workspace and up to 3 team members without a subscription.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
