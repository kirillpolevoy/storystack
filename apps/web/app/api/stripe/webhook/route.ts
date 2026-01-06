import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';
import { createClient } from '@supabase/supabase-js';
import { STRIPE_WEBHOOK_EVENTS, mapStripeStatus } from '@/lib/stripe/config';

// Use service role to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Email types for subscription notifications
type SubscriptionEmailType =
  | 'trial_started'
  | 'subscription_activated'
  | 'subscription_canceled'
  | 'subscription_reactivated'
  | 'payment_method_updated'
  | 'plan_changed'
  | 'payment_failed'
  | 'subscription_renewed';

// Send subscription notification email
async function sendSubscriptionEmail(
  userId: string,
  emailType: SubscriptionEmailType,
  metadata?: {
    plan_name?: string;
    billing_interval?: 'month' | 'year';
    previous_interval?: 'month' | 'year';
    end_date?: string;
    amount?: number;
    trial_end_date?: string | null;
  }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Use service role key for server-to-server edge function calls
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[Webhook] Attempting to send email:', {
      emailType,
      userId,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Webhook] Missing Supabase URL or service key for email');
      return;
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-subscription-email`;
    console.log('[Webhook] Calling edge function:', edgeFunctionUrl);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        email_type: emailType,
        metadata,
      }),
    });

    const responseText = await response.text();
    console.log('[Webhook] Edge function response:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
    });

    if (!response.ok) {
      console.error('[Webhook] Failed to send subscription email:', responseText);
    } else {
      console.log(`[Webhook] Subscription email sent successfully: ${emailType} for user ${userId}`);
    }
  } catch (error) {
    console.error('[Webhook] Error sending subscription email:', error);
    // Don't throw - email failure shouldn't fail the webhook
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    // Check if event already processed (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from('stripe_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true });
    }

    // Log event to database
    await supabaseAdmin.from('stripe_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      data: event.data as any,
      processed: false,
    });

    // Handle event based on type
    switch (event.type) {
      case STRIPE_WEBHOOK_EVENTS.CHECKOUT_SESSION_COMPLETED:
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED:
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED:
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await supabaseAdmin
      .from('stripe_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);

    // Log error to database
    await supabaseAdmin
      .from('stripe_events')
      .update({ error_message: error.message })
      .eq('stripe_event_id', event.id);

    // Return 200 to avoid Stripe retries for non-retriable errors
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  if (!userId) {
    throw new Error('Missing user_id in session metadata');
  }

  console.log('[Webhook] Checkout completed for user:', userId);

  // Get subscription details
  if (!session.subscription) {
    throw new Error('No subscription in checkout session');
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  console.log('[Webhook] Subscription status:', subscription.status, 'ID:', subscription.id);

  await upsertUserSubscription(userId, subscription);
  console.log('[Webhook] Upserted subscription for user:', userId);

  // Send appropriate welcome email based on subscription status
  const billingInterval = subscription.items.data[0]?.price?.recurring?.interval as 'month' | 'year';
  const isTrialing = subscription.status === 'trialing';

  if (isTrialing) {
    // Send trial started email
    const trialEndDate = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    await sendSubscriptionEmail(userId, 'trial_started', {
      plan_name: 'StoryStack Pro',
      billing_interval: billingInterval,
      trial_end_date: trialEndDate,
    });
    console.log('[Webhook] Sent trial_started email to user:', userId);
  } else {
    // Send subscription activated email (for returning users without trial)
    await sendSubscriptionEmail(userId, 'subscription_activated', {
      plan_name: 'StoryStack Pro',
      billing_interval: billingInterval,
    });
    console.log('[Webhook] Sent subscription_activated email to user:', userId);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[Webhook] Subscription updated/created:', {
    id: subscription.id,
    status: subscription.status,
    customerId: subscription.customer,
    metadataUserId: subscription.metadata?.user_id,
  });

  let resolvedUserId = subscription.metadata?.user_id;

  if (!resolvedUserId) {
    console.log('[Webhook] No user_id in metadata, looking up by customer ID');
    // Try to find user by customer ID
    const { data: existingSub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, billing_interval, status')
      .eq('stripe_customer_id', subscription.customer as string)
      .single();

    if (!existingSub) {
      throw new Error('Could not find user for subscription');
    }

    resolvedUserId = existingSub.user_id;

    // Check for plan change (billing interval change)
    const newInterval = subscription.items.data[0]?.price?.recurring?.interval as 'month' | 'year';
    const previousInterval = existingSub.billing_interval as 'month' | 'year';

    if (previousInterval && newInterval && previousInterval !== newInterval) {
      await sendSubscriptionEmail(resolvedUserId, 'plan_changed', {
        billing_interval: newInterval,
        previous_interval: previousInterval,
      });
    }

    // Check for reactivation (was canceled, now active)
    const newStatus = mapStripeStatus(subscription.status);
    if (existingSub.status === 'canceled' && newStatus === 'active') {
      await sendSubscriptionEmail(resolvedUserId, 'subscription_reactivated');
    }

    await upsertUserSubscription(resolvedUserId, subscription);
  } else {
    // Get existing subscription to check for changes
    const { data: existingSub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('billing_interval, status')
      .eq('user_id', resolvedUserId)
      .single();

    // Check for plan change
    const newInterval = subscription.items.data[0]?.price?.recurring?.interval as 'month' | 'year';
    if (existingSub?.billing_interval && newInterval && existingSub.billing_interval !== newInterval) {
      await sendSubscriptionEmail(resolvedUserId, 'plan_changed', {
        billing_interval: newInterval,
        previous_interval: existingSub.billing_interval as 'month' | 'year',
      });
    }

    // Check for reactivation
    const newStatus = mapStripeStatus(subscription.status);
    if (existingSub?.status === 'canceled' && newStatus === 'active') {
      await sendSubscriptionEmail(resolvedUserId, 'subscription_reactivated');
    }

    await upsertUserSubscription(resolvedUserId, subscription);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Get user ID before updating
  const { data: existingSub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id, current_period_end')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw error;
  }

  // Send cancellation email
  if (existingSub?.user_id) {
    const endDate = existingSub.current_period_end
      ? new Date(existingSub.current_period_end).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : undefined;

    await sendSubscriptionEmail(existingSub.user_id, 'subscription_canceled', {
      end_date: endDate,
    });
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;

  const subId = typeof subscriptionId === 'string'
    ? subscriptionId
    : subscriptionId.id;

  const subscription = await stripe.subscriptions.retrieve(subId);
  let userId = subscription.metadata?.user_id;

  // If no user ID in metadata, try to find by customer
  if (!userId) {
    const { data: existingSub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subId)
      .single();

    userId = existingSub?.user_id;
  }

  if (userId) {
    await upsertUserSubscription(userId, subscription);

    // Send renewal email only for recurring payments (not the first one)
    // Check if this is a recurring payment by looking at billing_reason
    if (invoice.billing_reason === 'subscription_cycle') {
      await sendSubscriptionEmail(userId, 'subscription_renewed', {
        amount: invoice.amount_paid,
        billing_interval: subscription.items.data[0]?.price?.recurring?.interval as 'month' | 'year',
      });
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;

  const subId = typeof subscriptionId === 'string'
    ? subscriptionId
    : subscriptionId.id;

  // Get user ID before updating
  const { data: existingSub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subId)
    .single();

  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subId);

  if (error) {
    console.error('Error updating subscription status to past_due:', error);
  }

  // Send payment failed email
  if (existingSub?.user_id) {
    await sendSubscriptionEmail(existingSub.user_id, 'payment_failed');
  }
}

async function upsertUserSubscription(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const price = subscription.items.data[0]?.price;
  const billingInterval = price?.recurring?.interval || 'month';

  // Extract quota from price metadata or use defaults
  const metadata = price?.metadata || {};
  const maxWorkspaces = parseInt(metadata.max_workspaces || '10', 10);
  const maxMembers = parseInt(metadata.max_members || '50', 10);

  // Get period from subscription item (API v2025+)
  const subscriptionItem = subscription.items.data[0];
  const periodStart = subscriptionItem?.current_period_start;
  const periodEnd = subscriptionItem?.current_period_end;

  const mappedStatus = mapStripeStatus(subscription.status);
  console.log('[Webhook] Upserting subscription:', {
    userId,
    stripeStatus: subscription.status,
    mappedStatus,
    subscriptionId: subscription.id,
  });

  const subscriptionData = {
    user_id: userId,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: mappedStatus,
    plan_name: price?.nickname || 'StoryStack Pro',
    billing_interval: billingInterval,
    max_workspaces: maxWorkspaces,
    max_members: maxMembers,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date().toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('[Webhook] Error upserting subscription:', error);
    throw error;
  }

  console.log('[Webhook] Successfully upserted subscription for user:', userId);
}
