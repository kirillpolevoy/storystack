'use client';

import { useCreatePortalSession } from '@/hooks/useSubscription';

interface ManageBillingButtonProps {
  className?: string;
  variant?: 'default' | 'outline';
}

export function ManageBillingButton({
  className = '',
  variant = 'default',
}: ManageBillingButtonProps) {
  const createPortalSession = useCreatePortalSession();

  const handleManageBilling = () => {
    createPortalSession.mutate();
  };

  const baseClasses = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = variant === 'default'
    ? 'bg-gray-900 text-white hover:bg-gray-800 focus-visible:outline-gray-900'
    : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50';

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleManageBilling}
        disabled={createPortalSession.isPending}
        className={`${baseClasses} ${variantClasses} ${className}`}
      >
        {createPortalSession.isPending ? (
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
          'Manage Billing'
        )}
      </button>

      {createPortalSession.isError && (
        <p className="text-sm text-red-600 text-center">
          {createPortalSession.error?.message || 'Failed to open billing portal. Please try again.'}
        </p>
      )}
    </div>
  );
}
