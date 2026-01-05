'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCreateCheckoutSession } from '@/hooks/useSubscription'
import { Sparkles, CreditCard, Shield, Loader2 } from 'lucide-react'

interface TrialGateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  reason?: 'no_subscription' | 'owner_no_subscription' | 'subscription_canceled' | 'owner_subscription_canceled' | 'subscription_inactive'
}

export function TrialGateModal({ open, onOpenChange, onSuccess, reason }: TrialGateModalProps) {
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('year')
  const createCheckoutSession = useCreateCheckoutSession()

  // Determine if this is a new user (eligible for trial) or returning user (must subscribe)
  // Users who had a subscription before (canceled, inactive) don't get another trial
  const hadPreviousSubscription = reason === 'subscription_canceled' || reason === 'subscription_inactive'
  const isGuestBlocked = reason === 'owner_no_subscription' || reason === 'owner_subscription_canceled'

  const handleSubscribe = () => {
    createCheckoutSession.mutate(
      {
        interval: selectedInterval,
        // Skip trial for users who already had a subscription (they already used their trial)
        skipTrial: hadPreviousSubscription,
      },
      {
        onSuccess: (data) => {
          // Redirect happens automatically in the hook
          onSuccess?.()
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header with accent background */}
        <div className="bg-accent/5 border-b border-accent/10 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-xl font-semibold text-gray-900">
                {isGuestBlocked
                  ? 'Pro features required'
                  : hadPreviousSubscription
                  ? 'Subscribe to continue'
                  : 'Start your 14-day Pro trial'}
              </DialogTitle>
            </DialogHeader>
          </div>
          <DialogDescription className="text-sm text-gray-600 leading-relaxed">
            {isGuestBlocked ? (
              'The workspace owner needs an active subscription to enable uploads and editing.'
            ) : hadPreviousSubscription ? (
              'Your subscription has ended. Subscribe to restore full access to your workspaces.'
            ) : (
              'Add a card to begin. You won\'t be charged until day 15. Cancel anytime.'
            )}
          </DialogDescription>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {isGuestBlocked ? (
            // Guest message - they can't start trial for someone else
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-4">
                Please contact the workspace owner to activate their subscription.
              </p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Got it
              </Button>
            </div>
          ) : (
            <>
              {/* Plan selection */}
              <div className="space-y-3 mb-5">
                <button
                  type="button"
                  onClick={() => setSelectedInterval('year')}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    selectedInterval === 'year'
                      ? 'border-accent bg-accent/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900">Annual</span>
                    <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      Save 17%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">$1,490</span>
                    <span className="text-sm text-gray-500">/year</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">That's $124/month, billed annually</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedInterval('month')}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    selectedInterval === 'month'
                      ? 'border-accent bg-accent/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900">Monthly</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">$149</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Billed monthly, cancel anytime</p>
                </button>
              </div>

              {/* Features highlight */}
              {hadPreviousSubscription ? (
                <div className="space-y-2 mb-5 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Shield className="h-4 w-4 text-accent" />
                    <span>Restore full access to your workspaces</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CreditCard className="h-4 w-4 text-accent" />
                    <span>Cancel anytime</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mb-5 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Shield className="h-4 w-4 text-accent" />
                    <span>14-day free trial, cancel anytime</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CreditCard className="h-4 w-4 text-accent" />
                    <span>You won't be charged until day 15</span>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="space-y-3">
                <Button
                  onClick={handleSubscribe}
                  disabled={createCheckoutSession.isPending}
                  className="w-full h-11"
                >
                  {createCheckoutSession.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {hadPreviousSubscription ? 'Subscribing...' : 'Starting trial...'}
                    </>
                  ) : hadPreviousSubscription ? (
                    'Subscribe now'
                  ) : (
                    'Start free trial'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="w-full text-gray-500 hover:text-gray-700"
                >
                  Maybe later
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
