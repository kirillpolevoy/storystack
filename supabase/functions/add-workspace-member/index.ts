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
        const logoUrl = `${siteUrl}/logo.png`
        const inviteLink = `${siteUrl}/login?invite=${invitation.id}`
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
                              
                              <!-- Main Content -->
                              <h1 style="margin: 0 0 16px 0; color: #111827; font-size: 32px; font-weight: 600; line-height: 1.2; letter-spacing: -0.8px;">
                                You're invited to join<br>${workspaceName}
                              </h1>
                              
                              <p style="margin: 0 0 32px 0; font-size: 17px; line-height: 1.6; color: #484848; font-weight: 400;">
                                ${inviterName} invited you to collaborate on StoryStack. You'll be able to organize, tag, and share your visual content together.
                              </p>
                              
                              <!-- Role Badge -->
                              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                                <tr>
                                  <td>
                                    <div style="display: inline-block; background-color: #f7f7f7; border-radius: 8px; padding: 8px 16px; font-size: 14px; color: #484848; font-weight: 500;">
                                      ${role.charAt(0).toUpperCase() + role.slice(1)} access
                                    </div>
                                  </td>
                                </tr>
                              </table>
                              
                              <!-- CTA Button -->
                              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 48px;">
                                <tr>
                                  <td>
                                    <a href="${inviteLink}" style="display: inline-block; background-color: #b38f5b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: -0.2px; text-align: center; min-width: 200px;">
                                      Accept invitation
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              
                              <!-- Divider -->
                              <div style="border-top: 1px solid #ebebeb; margin: 48px 0;"></div>
                              
                              <!-- Fallback Link -->
                              <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.5; color: #717171;">
                                Or copy and paste this link:
                              </p>
                              <p style="margin: 0 0 48px 0; font-size: 13px; line-height: 1.6; word-break: break-all;">
                                <a href="${inviteLink}" style="color: #b38f5b; text-decoration: underline;">${inviteLink}</a>
                              </p>
                              
                              <!-- Footer Note -->
                              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #717171; padding-top: 32px; border-top: 1px solid #ebebeb;">
                                This invitation expires in 30 days. If you didn't expect this invitation, you can safely ignore this email.
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
                                      © ${new Date().getFullYear()} StoryStack
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
            `,
            text: `
You're invited to join ${workspaceName}

${inviterName} invited you to collaborate on StoryStack. You'll be able to organize, tag, and share your visual content together.

You'll have ${role} access to the workspace.

Accept your invitation: ${inviteLink}

This invitation expires in 30 days. If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} StoryStack
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
      const logoUrl = `${siteUrl}/logo.png`
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
                              
                              <!-- Main Content -->
                              <h1 style="margin: 0 0 16px 0; color: #111827; font-size: 32px; font-weight: 600; line-height: 1.2; letter-spacing: -0.8px;">
                                You've been added to<br>${workspaceName}
                              </h1>
                              
                              <p style="margin: 0 0 32px 0; font-size: 17px; line-height: 1.6; color: #484848; font-weight: 400;">
                                ${inviterName} added you to this workspace. You can now organize, tag, and collaborate on visual content together.
                              </p>
                              
                              <!-- Role Badge -->
                              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                                <tr>
                                  <td>
                                    <div style="display: inline-block; background-color: #f7f7f7; border-radius: 8px; padding: 8px 16px; font-size: 14px; color: #484848; font-weight: 500;">
                                      ${role.charAt(0).toUpperCase() + role.slice(1)} access
                                    </div>
                                  </td>
                                </tr>
                              </table>
                              
                              <!-- CTA Button -->
                              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 48px;">
                                <tr>
                                  <td>
                                    <a href="${siteUrl}/app/library" style="display: inline-block; background-color: #b38f5b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: -0.2px; text-align: center; min-width: 200px;">
                                      Open workspace
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              
                              <!-- Footer Note -->
                              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #717171; padding-top: 32px; border-top: 1px solid #ebebeb;">
                                You can access this workspace anytime from your StoryStack dashboard.
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
                                      © ${new Date().getFullYear()} StoryStack
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
            `,
            text: `You've been added to ${workspaceName}

${inviterName} added you to this workspace. You can now organize, tag, and collaborate on visual content together.

You have ${role} access.

Open workspace: ${siteUrl}/app/library

You can access this workspace anytime from your StoryStack dashboard.

© ${new Date().getFullYear()} StoryStack`,
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

