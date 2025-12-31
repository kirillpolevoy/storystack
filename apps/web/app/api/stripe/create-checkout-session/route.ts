import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe, getOrCreateStripeCustomer, getPriceIdForInterval } from '@/lib/stripe/server';
import { CreateCheckoutSessionRequest } from '@/types/subscription';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: CreateCheckoutSessionRequest = await request.json();
    const { interval, priceId } = body;

    // Validate interval
    if (!interval || (interval !== 'month' && interval !== 'year')) {
      return NextResponse.json(
        { error: 'Invalid billing interval. Must be "month" or "year".' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has active subscription
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingSubscription && ['active', 'trialing'].includes(existingSubscription.status)) {
      return NextResponse.json(
        { error: 'You already have an active subscription. Please manage your billing instead.' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer({
      userId: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name,
    });

    // Determine price ID
    // Phase 1: Use environment variable based on interval
    // Phase 2: Use provided priceId (for tier selection)
    const selectedPriceId = priceId || getPriceIdForInterval(interval);

    // Get success and cancel URLs
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL;
    const successUrl = `${origin}/app/subscription?success=true`;
    const cancelUrl = `${origin}/app/subscription?canceled=true`;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        user_id: user.id,
        billing_interval: interval,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          billing_interval: interval,
        },
      },
    });

    // Return checkout session URL
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
