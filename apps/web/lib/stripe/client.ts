import { loadStripe, Stripe } from '@stripe/stripe-js';

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
}

/**
 * Singleton instance of Stripe client for the browser
 * Lazily initialized on first call to getStripe()
 */
let stripePromise: Promise<Stripe | null>;

/**
 * Get Stripe client instance
 * Safe to call multiple times - returns same instance
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
    );
  }
  return stripePromise;
}
