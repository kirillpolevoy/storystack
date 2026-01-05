import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';

// Send subscription notification email via edge function
async function sendSubscriptionEmail(
  userId: string,
  emailType: string,
  metadata?: Record<string, any>
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    console.log(`[UpdatePaymentMethod] Sending ${emailType} email for user ${userId}`);

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
      console.error('[UpdatePaymentMethod] Failed to send email:', error);
    } else {
      console.log(`[UpdatePaymentMethod] Email sent: ${emailType} for user ${userId}`);
    }
  } catch (error) {
    console.error('[UpdatePaymentMethod] Error sending email:', error);
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

    const { paymentMethodId } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID required' },
        { status: 400 }
      );
    }

    // Get user's subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_customer_id || !subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: subscription.stripe_customer_id,
    });

    // Set as default payment method for customer
    await stripe.customers.update(subscription.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update subscription to use new payment method
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      default_payment_method: paymentMethodId,
    });

    // Send payment method updated email
    await sendSubscriptionEmail(user.id, 'payment_method_updated');

    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating payment method:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update payment method' },
      { status: 500 }
    );
  }
}
