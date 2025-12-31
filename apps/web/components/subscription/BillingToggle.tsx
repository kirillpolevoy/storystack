'use client';

import { BillingInterval } from '@/lib/stripe/config';

interface BillingToggleProps {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  monthlyPrice: number;
  annualPrice: number;
  showSavings?: boolean;
}

export function BillingToggle({
  value,
  onChange,
  monthlyPrice,
  annualPrice,
  showSavings = true,
}: BillingToggleProps) {
  const annualSavings = (monthlyPrice * 12) - annualPrice;
  const savingsPercentage = Math.round((annualSavings / (monthlyPrice * 12)) * 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => onChange('month')}
          className={`
            rounded-md px-4 py-2 text-sm font-medium transition-all
            ${
              value === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange('year')}
          className={`
            rounded-md px-4 py-2 text-sm font-medium transition-all
            ${
              value === 'year'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          Annual
        </button>
      </div>

      {showSavings && value === 'year' && (
        <div className="text-sm text-accent font-medium">
          Save ${annualSavings.toLocaleString()}/year ({savingsPercentage}% off)
        </div>
      )}
    </div>
  );
}
