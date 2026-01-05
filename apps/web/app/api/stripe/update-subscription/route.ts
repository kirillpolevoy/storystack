import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';

// Admin client to bypass RLS for database updates
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Email types for subscription notifications
type SubscriptionEmailType =
  | 'subscription_activated'
  | 'subscription_canceled'
  | 'subscription_reactivated'
  | 'payment_method_updated'
  | 'plan_changed'
  | 'payment_failed'
  | 'subscription_renewed';

// Send subscription notification email via edge function
async function sendSubscriptionEmail(
  userId: string,
  emailType: SubscriptionEmailType,
  metadata?: {
    plan_name?: string;
    billing_interval?: 'month' | 'year';
    previous_interval?: 'month' | 'year';
    end_date?: string;
    amount?: number;
  }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-subscription-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        email_type: emailType,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[UpdateSubscription] Failed to send email:', error);
    } else {
      console.log(`[UpdateSubscription] Email sent: ${emailType} for user ${userId}`);
    }
  } catch (error) {
    console.error('[UpdateSubscription] Error sending email:', error);
    // Don't throw - email failure shouldn't fail the subscription update
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, interval } = await request.json();

    // Get user's subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, billing_interval')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'change_plan': {
        if (!interval || !['month', 'year'].includes(interval)) {
          return NextResponse.json(
            { error: 'Invalid interval' },
            { status: 400 }
          );
        }

        // Get the price ID for the new interval
        const newPriceId = interval === 'year'
          ? process.env.STRIPE_ANNUAL_PRICE_ID
          : process.env.STRIPE_MONTHLY_PRICE_ID;

        if (!newPriceId) {
          return NextResponse.json(
            { error: 'Price configuration missing' },
            { status: 500 }
          );
        }

        // Get current subscription to find the item ID
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );

        const subscriptionItemId = stripeSubscription.items.data[0]?.id;
        if (!subscriptionItemId) {
          return NextResponse.json(
            { error: 'Subscription item not found' },
            { status: 400 }
          );
        }

        // Update subscription with new price
        const updatedSubscription = await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            items: [
              {
                id: subscriptionItemId,
                price: newPriceId,
              },
            ],
            proration_behavior: 'create_prorations',
          }
        );

        // Update local database immediately
        const subscriptionItem = updatedSubscription.items.data[0];
        const previousInterval = subscription.billing_interval as 'month' | 'year';

        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            billing_interval: interval,
            stripe_price_id: newPriceId,
            current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        // Send plan change email
        await sendSubscriptionEmail(user.id, 'plan_changed', {
          billing_interval: interval as 'month' | 'year',
          previous_interval: previousInterval,
        });

        return NextResponse.json({
          success: true,
          message: `Switched to ${interval}ly billing`,
          subscription: {
            status: updatedSubscription.status,
            billingInterval: interval,
            currentPeriodEnd: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
          },
        });
      }

      case 'cancel': {
        // Cancel at end of billing period
        const canceledSubscription = await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            cancel_at_period_end: true,
          }
        );

        // Get current period end for email
        const { data: subData } = await supabaseAdmin
          .from('user_subscriptions')
          .select('current_period_end')
          .eq('user_id', user.id)
          .single();

        // Update local database immediately
        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        // Send cancellation email
        const endDate = subData?.current_period_end
          ? new Date(subData.current_period_end).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : undefined;

        await sendSubscriptionEmail(user.id, 'subscription_canceled', {
          end_date: endDate,
        });

        return NextResponse.json({
          success: true,
          message: 'Subscription will be canceled at the end of the billing period',
          cancelAt: canceledSubscription.cancel_at
            ? new Date(canceledSubscription.cancel_at * 1000).toISOString()
            : null,
        });
      }

      case 'reactivate': {
        // Remove cancellation
        await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            cancel_at_period_end: false,
          }
        );

        // Update local database immediately
        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        // Send reactivation email
        await sendSubscriptionEmail(user.id, 'subscription_reactivated');

        return NextResponse.json({
          success: true,
          message: 'Subscription reactivated',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
