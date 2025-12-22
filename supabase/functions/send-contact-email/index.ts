import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // Get authorization header (optional for contact form - allow unauthenticated submissions)
    const authHeader = req.headers.get('Authorization')
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : {},
    })

    // Get user if authenticated (optional)
    let user = null
    if (authHeader) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      user = authUser
    }

    // Parse request body
    let body
    try {
      body = await req.json()
    } catch (error) {
      console.error('[Contact Email] Error parsing request body:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, subject, message, userId } = body

    // Validate required fields
    if (!email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, subject, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract name from email (use part before @) or use a default
    const emailName = email.split('@')[0]
    const name = emailName.charAt(0).toUpperCase() + emailName.slice(1) || 'User'

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      console.error('[Contact Email] RESEND_API_KEY not set - cannot send email')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!resendApiKey.startsWith('re_')) {
      console.error('[Contact Email] RESEND_API_KEY format invalid - should start with "re_"')
      return new Response(
        JSON.stringify({ error: 'Email service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use user's email as the "from" address
    // Format: "Name <email@domain.com>"
    // Note: The domain must be verified in Resend for this to work
    // If domain is not verified, Resend will reject it and we'll need to fall back
    const fromEmail = `${name} <${email}>`
    const toEmail = 'kpolevoy@gmail.com'
    
    // Fallback to verified domain if user's domain might not be verified
    // This is a safety fallback - if the user's email domain isn't verified in Resend,
    // the email will fail. In that case, you'd need to verify the domain or use a different approach.
    const fallbackFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'StoryStack <onboarding@resend.dev>'

    // Create email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contact Form Submission</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #D4A574 0%, #C8965E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Contact Form Submission</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="margin-bottom: 20px;">
              <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">From</strong>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #111827;">${escapeHtml(name)}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">${escapeHtml(email)}</p>
              ${user ? `<p style="margin: 5px 0 0 0; font-size: 12px; color: #9ca3af;">User ID: ${user.id}</p>` : ''}
            </div>
            
            <div style="margin-bottom: 20px;">
              <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Subject</strong>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #111827;">${escapeHtml(subject)}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</strong>
              <div style="margin: 10px 0 0 0; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #D4A574;">
                <p style="margin: 0; font-size: 15px; color: #374151; white-space: pre-wrap;">${escapeHtml(message)}</p>
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                This message was sent from the StoryStack contact form.
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    const emailText = `
New Contact Form Submission

From: ${name} (${email})
${user ? `User ID: ${user.id}\n` : ''}
Subject: ${subject}

Message:
${message}

---
This message was sent from the StoryStack contact form.
    `.trim()

    // Send email via Resend API
    console.log('[Contact Email] Sending email via Resend API...')
    console.log('[Contact Email] From email:', fromEmail)
    
    // Try to send with user's email as "from"
    // If this fails due to domain verification, we'll catch the error
    let emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `[StoryStack Contact] ${subject}`,
        html: emailHtml,
        text: emailText,
      }),
    })

    // If sending with user's email fails (likely due to unverified domain),
    // fall back to using the verified domain but still set reply_to to user's email
    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}))
      console.warn('[Contact Email] Failed to send with user email, trying fallback:', errorData)
      
      // Try again with verified domain as "from"
      emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fallbackFromEmail,
          to: [toEmail],
          reply_to: email,
          subject: `[StoryStack Contact] ${subject}`,
          html: emailHtml,
          text: emailText,
        }),
      })
    }

    console.log('[Contact Email] Resend API response status:', emailResponse.status)

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}))
      console.error('[Contact Email] Resend API error:', {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        error: errorData,
      })

      // Provide helpful error messages
      if (emailResponse.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: 'Email service error',
            details: 'Domain not verified. Please verify your domain at https://resend.com/domains or use the test email address.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: errorData.message || 'Unknown error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailResult = await emailResponse.json()
    console.log('[Contact Email] Email sent successfully:', emailResult)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Contact form submitted successfully',
        emailId: emailResult.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Contact Email] Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

