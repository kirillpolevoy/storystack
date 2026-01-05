import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EmailType =
  | 'subscription_activated'
  | 'subscription_canceled'
  | 'subscription_reactivated'
  | 'payment_method_updated'
  | 'plan_changed'
  | 'payment_failed'
  | 'subscription_renewed'

interface EmailRequest {
  user_id: string
  email_type: EmailType
  metadata?: {
    plan_name?: string
    billing_interval?: 'month' | 'year'
    previous_interval?: 'month' | 'year'
    end_date?: string
    amount?: number
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { user_id, email_type, metadata = {} }: EmailRequest = await req.json()

    if (!user_id || !email_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, email_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get user details
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id)

    if (userError || !userData?.user?.email) {
      console.error('[Email] Failed to get user:', userError)
      return new Response(
        JSON.stringify({ error: 'Failed to get user details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userEmail = userData.user.email
    const userName = userData.user.user_metadata?.full_name || userEmail.split('@')[0]

    // Get email content based on type
    const emailContent = getEmailContent(email_type, userName, metadata)

    if (!emailContent) {
      return new Response(
        JSON.stringify({ error: 'Invalid email type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const siteUrl = Deno.env.get('SITE_URL') || 'https://storystackstudios.com'
    const logoUrl = `${siteUrl}/logo.png`

    if (!resendApiKey || !resendApiKey.startsWith('re_')) {
      console.error('[Email] RESEND_API_KEY not configured properly')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use billing-specific from address for subscription emails
    const fromEmail = 'StoryStack Billing <billing@storystackstudios.com>'

    console.log('[Email] Sending subscription email:', {
      type: email_type,
      to: userEmail,
      subject: emailContent.subject,
    })

    const emailPayload = {
      from: fromEmail,
      to: userEmail,
      subject: emailContent.subject,
      html: generateEmailHtml(emailContent, logoUrl, siteUrl),
      text: emailContent.textBody,
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text()
      console.error('[Email] Resend API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailResult = await emailResponse.json()
    console.log('[Email] Subscription email sent successfully:', {
      emailId: emailResult.id,
      type: email_type,
      to: userEmail,
    })

    return new Response(
      JSON.stringify({ success: true, email_id: emailResult.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Email] Error sending subscription email:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

interface EmailContent {
  subject: string
  heading: string
  message: string
  ctaText: string
  ctaUrl: string
  footerNote: string
  textBody: string
  iconType: 'success' | 'warning' | 'info' | 'error'
}

function getEmailContent(
  type: EmailType,
  userName: string,
  metadata: EmailRequest['metadata']
): EmailContent | null {
  const planDisplay = metadata?.billing_interval === 'year' ? 'Annual' : 'Monthly'
  const amountDisplay = metadata?.amount ? `$${(metadata.amount / 100).toFixed(0)}` : ''

  switch (type) {
    case 'subscription_activated':
      return {
        subject: 'Welcome to StoryStack Pro!',
        heading: `Welcome to StoryStack Pro, ${userName}!`,
        message: `Your subscription is now active. You have full access to all Pro features including up to 10 workspaces, 50 team members, AI-powered organization, and priority support.`,
        ctaText: 'Go to Dashboard',
        ctaUrl: '/app/library',
        footerNote: 'Thank you for subscribing! If you have any questions, our support team is here to help.',
        iconType: 'success',
        textBody: `Welcome to StoryStack Pro, ${userName}!\n\nYour subscription is now active. You have full access to all Pro features including up to 10 workspaces, 50 team members, AI-powered organization, and priority support.\n\nThank you for subscribing!`,
      }

    case 'subscription_canceled':
      return {
        subject: 'Your StoryStack subscription has been canceled',
        heading: 'Your subscription has been canceled',
        message: metadata?.end_date
          ? `Your StoryStack Pro subscription has been canceled. You'll continue to have access to Pro features until ${metadata.end_date}. After that, your account will revert to the free plan.`
          : `Your StoryStack Pro subscription has been canceled. You'll continue to have access until the end of your current billing period.`,
        ctaText: 'Reactivate Subscription',
        ctaUrl: '/app/subscription',
        footerNote: 'We\'re sorry to see you go! You can reactivate your subscription anytime from your account settings.',
        iconType: 'warning',
        textBody: `Your StoryStack Pro subscription has been canceled.\n\n${metadata?.end_date ? `You'll continue to have access until ${metadata.end_date}.` : 'You\'ll continue to have access until the end of your current billing period.'}\n\nYou can reactivate anytime from your subscription settings.`,
      }

    case 'subscription_reactivated':
      return {
        subject: 'Your StoryStack subscription is back!',
        heading: 'Welcome back to StoryStack Pro!',
        message: `Great news! Your subscription has been reactivated. You now have full access to all Pro features again.`,
        ctaText: 'Go to Dashboard',
        ctaUrl: '/app/library',
        footerNote: 'Thank you for continuing with StoryStack Pro!',
        iconType: 'success',
        textBody: `Welcome back to StoryStack Pro!\n\nYour subscription has been reactivated. You now have full access to all Pro features again.\n\nThank you for continuing with StoryStack Pro!`,
      }

    case 'payment_method_updated':
      return {
        subject: 'Payment method updated',
        heading: 'Your payment method has been updated',
        message: `Your payment method for StoryStack Pro has been successfully updated. Your next payment will be charged to your new payment method.`,
        ctaText: 'View Subscription',
        ctaUrl: '/app/subscription',
        footerNote: 'If you didn\'t make this change, please contact support immediately.',
        iconType: 'info',
        textBody: `Your payment method has been updated.\n\nYour payment method for StoryStack Pro has been successfully updated. Your next payment will be charged to your new payment method.\n\nIf you didn't make this change, please contact support immediately.`,
      }

    case 'plan_changed':
      const fromPlan = metadata?.previous_interval === 'year' ? 'Annual' : 'Monthly'
      const toPlan = metadata?.billing_interval === 'year' ? 'Annual' : 'Monthly'
      return {
        subject: `You've switched to ${toPlan} billing`,
        heading: `You've switched to ${toPlan} billing`,
        message: `Your StoryStack Pro plan has been changed from ${fromPlan} to ${toPlan} billing. ${
          metadata?.billing_interval === 'year'
            ? 'Great choice! You\'re now saving 17% with annual billing.'
            : 'Your billing cycle has been updated accordingly.'
        }`,
        ctaText: 'View Subscription',
        ctaUrl: '/app/subscription',
        footerNote: 'The change will be reflected in your next billing cycle.',
        iconType: 'info',
        textBody: `You've switched to ${toPlan} billing.\n\nYour StoryStack Pro plan has been changed from ${fromPlan} to ${toPlan} billing.\n\nThe change will be reflected in your next billing cycle.`,
      }

    case 'payment_failed':
      return {
        subject: 'Payment failed - action required',
        heading: 'We couldn\'t process your payment',
        message: `We were unable to process your payment for StoryStack Pro. Please update your payment method to continue enjoying Pro features without interruption.`,
        ctaText: 'Update Payment Method',
        ctaUrl: '/app/subscription',
        footerNote: 'If you\'re experiencing issues, please contact our support team.',
        iconType: 'error',
        textBody: `We couldn't process your payment.\n\nWe were unable to process your payment for StoryStack Pro. Please update your payment method to continue enjoying Pro features without interruption.\n\nIf you're experiencing issues, please contact our support team.`,
      }

    case 'subscription_renewed':
      return {
        subject: 'Your StoryStack subscription has been renewed',
        heading: 'Subscription renewed successfully',
        message: `Your StoryStack Pro subscription has been renewed${amountDisplay ? ` for ${amountDisplay}` : ''}. Thank you for your continued support!`,
        ctaText: 'View Invoice',
        ctaUrl: '/app/subscription',
        footerNote: 'You can view your invoice history in the billing portal.',
        iconType: 'success',
        textBody: `Your StoryStack Pro subscription has been renewed${amountDisplay ? ` for ${amountDisplay}` : ''}.\n\nThank you for your continued support!\n\nYou can view your invoice history in the billing portal.`,
      }

    default:
      return null
  }
}

function generateEmailHtml(content: EmailContent, logoUrl: string, siteUrl: string): string {
  // Use Unicode symbols that render in all email clients
  const iconSymbol = {
    success: '✓',
    warning: '!',
    info: 'i',
    error: '✕',
  }[content.iconType]

  const iconColor = {
    success: '#16a34a',
    warning: '#d97706',
    info: '#2563eb',
    error: '#dc2626',
  }[content.iconType]

  const iconBgColor = {
    success: '#dcfce7',
    warning: '#fef3c7',
    info: '#dbeafe',
    error: '#fee2e2',
  }[content.iconType]

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
          <tr>
            <td align="center" style="padding: 0;">
              <!-- Main Container -->
              <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; margin: 0 auto;">
                <!-- Spacer Top -->
                <tr>
                  <td style="padding: 64px 24px 0 24px;">
                    <!-- Logo -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-bottom: 48px;">
                          <table role="presentation" style="border-collapse: collapse;">
                            <tr>
                              <td style="padding-right: 12px; vertical-align: middle;">
                                <img src="${logoUrl}" alt="StoryStack" width="32" height="32" style="display: block; width: 32px; height: 32px;" />
                              </td>
                              <td style="vertical-align: middle;">
                                <div style="font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.5px;">StoryStack</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Status Icon -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                      <tr>
                        <td>
                          <div style="display: inline-block; width: 48px; height: 48px; border-radius: 50%; background-color: ${iconBgColor}; text-align: center; line-height: 48px; font-size: 24px; font-weight: bold; color: ${iconColor};">
                            ${iconSymbol}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Main Content -->
                    <h1 style="margin: 0 0 16px 0; color: #111827; font-size: 28px; font-weight: 600; line-height: 1.2; letter-spacing: -0.5px;">
                      ${content.heading}
                    </h1>

                    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #484848; font-weight: 400;">
                      ${content.message}
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 48px;">
                      <tr>
                        <td>
                          <a href="${siteUrl}${content.ctaUrl}" style="display: inline-block; background-color: #b38f5b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: -0.2px; text-align: center; min-width: 180px;">
                            ${content.ctaText}
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Footer Note -->
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #717171; padding-top: 32px; border-top: 1px solid #ebebeb;">
                      ${content.footerNote}
                    </p>
                  </td>
                </tr>

                <!-- Bottom Spacer -->
                <tr>
                  <td style="padding: 48px 24px 64px 24px;">
                    <!-- Footer -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td align="center" style="padding-top: 32px; border-top: 1px solid #ebebeb;">
                          <p style="margin: 0; font-size: 12px; color: #b0b0b0; line-height: 1.5;">
                            &copy; ${new Date().getFullYear()} StoryStack
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}
