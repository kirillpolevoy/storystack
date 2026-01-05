import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

/**
 * Server-side Stripe client
 * This should only be used in server-side code (API routes, server components)
 * Never expose this client to the browser
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
  appInfo: {
    name: 'StoryStack',
    version: '1.0.0',
  },
});

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(params: {
  userId: string;
  email: string;
  name?: string;
}): Promise<string> {
  const { userId, email, name } = params;

  // Check if customer already exists by searching for metadata
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      user_id: userId,
    },
  });

  return customer.id;
}

/**
 * Get price IDs from environment variables
 */
export function getPriceIds() {
  const monthly = process.env.STRIPE_MONTHLY_PRICE_ID;
  const annual = process.env.STRIPE_ANNUAL_PRICE_ID;

  if (!monthly) {
    throw new Error('STRIPE_MONTHLY_PRICE_ID is not set');
  }

  if (!annual) {
    throw new Error('STRIPE_ANNUAL_PRICE_ID is not set');
  }

  return { monthly, annual };
}

/**
 * Get price ID based on billing interval
 */
export function getPriceIdForInterval(interval: 'month' | 'year'): string {
  const priceIds = getPriceIds();
  return interval === 'month' ? priceIds.monthly : priceIds.annual;
}
