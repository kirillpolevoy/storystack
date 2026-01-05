import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';
import { SubscriptionStatusResponse, PaymentMethodInfo } from '@/types/subscription';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
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

    // Get user's subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get workspace count using database function
    const { data: workspaceCountData } = await supabase
      .rpc('get_user_workspace_count', { p_user_id: user.id });

    // Get member count using database function
    const { data: memberCountData } = await supabase
      .rpc('get_user_total_member_count', { p_user_id: user.id });

    // Get quota check results
    const { data: canCreateWorkspace } = await supabase
      .rpc('can_user_create_workspace', { p_user_id: user.id });

    const { data: canAddMember } = await supabase
      .rpc('can_user_add_member', { p_user_id: user.id });

    const workspaceCount = workspaceCountData || 0;
    const memberCount = memberCountData || 0;

    // Fetch payment method from Stripe if subscription exists
    let paymentMethod: PaymentMethodInfo | null = null;
    let trialEnd: string | null = null;

    if (subscription?.stripe_subscription_id) {
      try {
        // First, try to get payment method from the subscription itself
        // (Checkout sessions attach payment method to subscription, not customer)
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

        // Get trial end date if in trial
        if (stripeSubscription.trial_end) {
          trialEnd = new Date(stripeSubscription.trial_end * 1000).toISOString();
        }

        let paymentMethodId: string | null = null;

        // Check subscription's default payment method first
        if (stripeSubscription.default_payment_method) {
          paymentMethodId = typeof stripeSubscription.default_payment_method === 'string'
            ? stripeSubscription.default_payment_method
            : stripeSubscription.default_payment_method.id;
        }

        // Fallback to customer's default payment method
        if (!paymentMethodId && subscription.stripe_customer_id) {
          const customer = await stripe.customers.retrieve(subscription.stripe_customer_id);
          if (customer && !customer.deleted && customer.invoice_settings?.default_payment_method) {
            paymentMethodId = customer.invoice_settings.default_payment_method as string;
          }
        }

        // Retrieve the payment method details
        if (paymentMethodId) {
          const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
          if (pm.card) {
            paymentMethod = {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            };
          }
        }
      } catch (stripeError) {
        console.error('Error fetching payment method from Stripe:', stripeError);
        // Don't fail the request if we can't get payment method
      }
    }

    const response: SubscriptionStatusResponse = {
      subscription: subscription
        ? {
            status: subscription.status,
            planName: subscription.plan_name,
            billingInterval: subscription.billing_interval,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            maxWorkspaces: subscription.max_workspaces,
            maxMembers: subscription.max_members,
            trialEnd,
          }
        : null,
      paymentMethod,
      usage: {
        workspaceCount,
        memberCount,
      },
      canCreateWorkspace: canCreateWorkspace ?? false,
      canAddMember: canAddMember ?? false,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
