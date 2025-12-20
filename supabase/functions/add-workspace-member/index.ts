import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { workspace_id, email, role } = await req.json()

    if (!workspace_id || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: workspace_id, email, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be admin, editor, or viewer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if requester has admin+ role in the workspace
    const { data: requesterMember, error: requesterError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (requesterError || !requesterMember) {
      return new Response(
        JSON.stringify({ error: 'You are not a member of this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const roleHierarchy = { owner: 4, admin: 3, editor: 2, viewer: 1 }
    if (roleHierarchy[requesterMember.role as keyof typeof roleHierarchy] < roleHierarchy.admin) {
      return new Response(
        JSON.stringify({ error: 'Only admins and owners can add members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client to query auth.users via Admin API
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Find user by email using Admin API
    let targetUserId: string | null = null
    
    try {
      // Use admin API to list users and find by email
      // Note: This may require pagination if you have many users
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      
      if (listError) {
        console.error('Error listing users:', listError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to search for user',
            details: listError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (usersData && usersData.users) {
        const foundUser = usersData.users.find(u => 
          u.email?.toLowerCase() === email.toLowerCase()
        )
        if (foundUser) {
          targetUserId = foundUser.id
        }
      }
    } catch (error) {
      console.error('Error searching for user:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to search for user',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If user doesn't exist, create an invitation instead
    if (!targetUserId) {
      console.log('User does not exist, creating invitation for:', email.toLowerCase())
      
      // Check if there's already a pending invitation for this email
      const { data: existingInvitation, error: checkInviteError } = await supabaseAdmin
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', workspace_id)
        .eq('email', email.toLowerCase())
        .eq('status', 'pending')
        .maybeSingle()

      if (checkInviteError) {
        console.error('Error checking existing invitation:', checkInviteError)
      }

      if (existingInvitation) {
        console.log('Invitation already exists:', existingInvitation)
        return new Response(
          JSON.stringify({ 
            error: 'Invitation already exists',
            message: 'An invitation has already been sent to this email address.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create invitation (expires in 30 days)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      console.log('Creating invitation with data:', {
        workspace_id,
        email: email.toLowerCase(),
        role,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })

      // Use service role client (already created above) to bypass RLS for invitation creation
      // (We've already verified the user has admin+ role above)
      const { data: invitation, error: inviteError } = await supabaseAdmin
        .from('workspace_invitations')
        .insert({
          workspace_id,
          email: email.toLowerCase(),
          role,
          invited_by: user.id,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (inviteError) {
        console.error('Error creating invitation:', inviteError)
        console.error('Invitation insert error details:', JSON.stringify(inviteError, null, 2))
        return new Response(
          JSON.stringify({ error: 'Failed to create invitation', details: inviteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('Invitation created successfully:', invitation)

      // Get workspace name for email
      const { data: workspace } = await supabaseAdmin
        .from('workspaces')
        .select('name')
        .eq('id', workspace_id)
        .single()

      // Get inviter's email
      const { data: inviter } = await supabaseAdmin.auth.admin.getUserById(user.id)

      // Send invitation email using Resend
      try {
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        const siteUrl = Deno.env.get('SITE_URL') || 'https://storystackstudios.com'
        const inviteLink = `${siteUrl}/signup?invite=${invitation.id}`
        const workspaceName = workspace?.name || 'a workspace'
        const inviterEmail = inviter?.user?.email || 'a team member'
        const inviterName = inviter?.user?.user_metadata?.full_name || inviterEmail.split('@')[0]

        console.log('[Email] Starting email send process:', {
          hasResendKey: !!resendApiKey,
          resendKeyPrefix: resendApiKey?.substring(0, 5) || 'none',
          resendKeyLength: resendApiKey?.length || 0,
          to: email.toLowerCase(),
          workspaceName,
          inviteLink,
        })

        if (!resendApiKey) {
          console.error('[Email] RESEND_API_KEY not set - skipping email send')
          console.error('[Email] To enable emails, run: supabase secrets set RESEND_API_KEY=re_your_key')
        } else if (!resendApiKey.startsWith('re_')) {
          console.error('[Email] RESEND_API_KEY format invalid - should start with "re_"')
          console.error('[Email] Current key prefix:', resendApiKey.substring(0, 5))
        } else {
          console.log('[Email] Attempting to send email via Resend API...')
          
          // Use verified domain email for production
          // Set RESEND_FROM_EMAIL environment variable to use your verified domain
          // Example: supabase secrets set RESEND_FROM_EMAIL="StoryStack <invites@kirillpolevoy.com>"
          const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'StoryStack <onboarding@resend.dev>'

          const emailPayload = {
            from: fromEmail,
            to: email.toLowerCase(),
            subject: `You've been invited to join ${workspaceName} on StoryStack`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">StoryStack</h1>
                  </div>
                  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #111827; margin-top: 0;">You've been invited!</h2>
                    <p style="font-size: 16px; color: #4b5563;">
                      <strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on StoryStack.
                    </p>
                    <p style="font-size: 16px; color: #4b5563;">
                      You'll have <strong>${role}</strong> access to the workspace.
                    </p>
                    <div style="text-align: center; margin: 40px 0;">
                      <a href="${inviteLink}" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Accept Invitation
                      </a>
                    </div>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                      If the button doesn't work, copy and paste this link into your browser:<br>
                      <a href="${inviteLink}" style="color: #667eea; word-break: break-all;">${inviteLink}</a>
                    </p>
                    <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
                      This invitation will expire in 30 days. If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                  </div>
                </body>
              </html>
            `,
            text: `
You've been invited to join ${workspaceName} on StoryStack!

${inviterName} has invited you to join ${workspaceName}. You'll have ${role} access to the workspace.

Accept your invitation: ${inviteLink}

This invitation will expire in 30 days. If you didn't expect this invitation, you can safely ignore this email.
            `.trim(),
          }

          console.log('[Email] Sending to Resend API:', {
            from: emailPayload.from,
            to: emailPayload.to,
            subject: emailPayload.subject,
          })

          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailPayload),
          })

          console.log('[Email] Resend API response status:', emailResponse.status)

          if (!emailResponse.ok) {
            const errorData = await emailResponse.text()
            let errorJson
            try {
              errorJson = JSON.parse(errorData)
            } catch {
              errorJson = { message: errorData }
            }
            
            console.error('[Email] Resend API error:', {
              status: emailResponse.status,
              statusText: emailResponse.statusText,
              error: errorJson,
            })
            
            // If it's a domain verification error, log helpful message
            if (errorJson.message?.includes('verify a domain')) {
              console.error('[Email] Domain not verified. Options:')
              console.error('[Email] 1. Verify domain at https://resend.com/domains')
              console.error('[Email] 2. Update from address to use verified domain')
              console.error('[Email] 3. For testing, only send to:', verifiedEmail)
            }
            // Don't throw - invitation is still created
          } else {
            const emailResult = await emailResponse.json()
            console.log('[Email] ✅ Invitation email sent successfully:', {
              emailId: emailResult.id,
              to: emailPayload.to,
            })
          }
        }
      } catch (emailError) {
        console.error('[Email] ❌ Exception sending invitation email:', emailError)
        console.error('[Email] Error details:', emailError instanceof Error ? emailError.stack : String(emailError))
        // Don't fail the request if email fails - invitation is still created
        // The user can still sign up and be added automatically
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          invitation: invitation,
          message: 'Invitation sent successfully. The user will be added to the workspace when they sign up.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // User exists - check if already a member
    console.log('User exists, checking membership. User ID:', targetUserId)
    const { data: existingMember, error: memberCheckError } = await supabaseAdmin
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (memberCheckError) {
      console.error('Error checking existing member:', memberCheckError)
    }

    if (existingMember) {
      console.log('User is already a member:', existingMember)
      return new Response(
        JSON.stringify({ error: 'User is already a member of this workspace' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('User exists but is not a member, adding them...')

    // Check if there's a pending invitation for this user
    const { data: pendingInvitation } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single()

    // If there's a pending invitation, mark it as accepted
    if (pendingInvitation) {
      await supabase
        .from('workspace_invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', pendingInvitation.id)
    }

    // Add user to workspace
    const { data: newMember, error: insertError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id,
        user_id: targetUserId,
        role,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding member:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to add member', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send notification email to existing user
    try {
      const { data: workspace } = await supabaseAdmin
        .from('workspaces')
        .select('name')
        .eq('id', workspace_id)
        .single()

      const { data: inviter } = await supabaseAdmin.auth.admin.getUserById(user.id)
      const { data: addedUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      const siteUrl = Deno.env.get('SITE_URL') || 'https://storystackstudios.com'
      const workspaceName = workspace?.name || 'a workspace'
      const inviterEmail = inviter?.user?.email || 'a team member'
      const inviterName = inviter?.user?.user_metadata?.full_name || inviterEmail.split('@')[0]

      if (resendApiKey && resendApiKey.startsWith('re_') && addedUser?.user?.email) {
        const recipientEmail = addedUser.user.email
        
        // Use verified domain email for production
        const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'StoryStack <onboarding@resend.dev>'
        
        console.log('[Email] Sending workspace access notification to existing user:', recipientEmail)
        
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: recipientEmail,
            subject: `You've been added to ${workspaceName} on StoryStack`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">StoryStack</h1>
                  </div>
                  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #111827; margin-top: 0;">You've been added to a workspace!</h2>
                    <p style="font-size: 16px; color: #4b5563;">
                      <strong>${inviterName}</strong> has added you to <strong>${workspaceName}</strong> on StoryStack.
                    </p>
                    <p style="font-size: 16px; color: #4b5563;">
                      You now have <strong>${role}</strong> access to the workspace.
                    </p>
                    <div style="text-align: center; margin: 40px 0;">
                      <a href="${siteUrl}/app/library" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Open Workspace
                      </a>
                    </div>
                  </div>
                </body>
              </html>
            `,
            text: `You've been added to ${workspaceName} on StoryStack!\n\n${inviterName} has added you to ${workspaceName}. You now have ${role} access.\n\nOpen workspace: ${siteUrl}/app/library`,
          }),
        })

        if (emailResponse.ok) {
          const emailResult = await emailResponse.json()
          console.log('[Email] ✅ Notification email sent successfully:', {
            emailId: emailResult.id,
            to: recipientEmail,
          })
        } else {
          const errorData = await emailResponse.text()
          let errorJson
          try {
            errorJson = JSON.parse(errorData)
          } catch {
            errorJson = { message: errorData }
          }
          console.error('[Email] Failed to send notification:', {
            status: emailResponse.status,
            error: errorJson,
          })
          if (errorJson.message?.includes('verify a domain')) {
            console.error('[Email] Domain not verified. Verify at https://resend.com/domains')
          }
        }
      }
    } catch (emailError) {
      console.error('[Email] Error sending notification email:', emailError)
      // Don't fail - member is already added
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        member: newMember,
        message: 'Member added successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in add-workspace-member:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

