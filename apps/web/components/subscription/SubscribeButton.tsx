'use client';

import { useState } from 'react';
import { BillingInterval } from '@/lib/stripe/config';
import { useCreateCheckoutSession } from '@/hooks/useSubscription';
import { BillingToggle } from './BillingToggle';

interface SubscribeButtonProps {
  className?: string;
  variant?: 'default' | 'primary';
  showBillingToggle?: boolean;
}

const PRICING = {
  monthly: 149,
  annual: 1490,
};

export function SubscribeButton({
  className = '',
  variant = 'primary',
  showBillingToggle = true,
}: SubscribeButtonProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const createCheckoutSession = useCreateCheckoutSession();

  const handleSubscribe = () => {
    createCheckoutSession.mutate({ interval: billingInterval });
  };

  const price = billingInterval === 'month' ? PRICING.monthly : PRICING.annual;
  const displayPrice = billingInterval === 'month'
    ? `$${price}/month`
    : `$${price}/year`;

  const baseButtonClasses = 'w-full inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = variant === 'primary'
    ? 'bg-accent text-white hover:bg-accent/90 focus-visible:outline-accent'
    : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50';

  return (
    <div className="flex flex-col gap-4">
      {showBillingToggle && (
        <BillingToggle
          value={billingInterval}
          onChange={setBillingInterval}
          monthlyPrice={PRICING.monthly}
          annualPrice={PRICING.annual}
        />
      )}

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={createCheckoutSession.isPending}
        className={`${baseButtonClasses} ${variantClasses} ${className}`}
      >
        {createCheckoutSession.isPending ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          <>
            Subscribe {displayPrice}
          </>
        )}
      </button>

      {createCheckoutSession.isError && (
        <p className="text-sm text-red-600 text-center">
          {createCheckoutSession.error?.message || 'Failed to start checkout. Please try again.'}
        </p>
      )}
    </div>
  );
}
