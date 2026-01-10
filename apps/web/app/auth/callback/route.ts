import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Wait for workspace to be visible (created by trigger, might take a moment for RLS)
async function waitForWorkspace(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: workspaces } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)

    if (workspaces && workspaces.length > 0) {
      console.log(`[Auth Callback] Workspace found on attempt ${i + 1}`)
      return true
    }

    // Wait before retry (500ms, 1s, 1.5s, etc.)
    await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)))
  }

  console.warn('[Auth Callback] Workspace not found after retries')
  return false
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/app/library'
  const origin = requestUrl.origin

  const supabase = await createClient()

  // Handle PKCE flow (code-based)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successfully exchanged code for session - user is now logged in
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[Auth Callback] Error exchanging code:', error)
  }

  // Handle magic link / OTP flow (token_hash-based)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'signup' | 'recovery' | 'email_change',
    })

    if (!error) {
      const isSignup = type === 'signup'

      // For signups, wait for workspace to be created/visible before redirecting
      // The database trigger creates workspace on auth.users INSERT, but RLS might delay visibility
      if (isSignup) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          console.log('[Auth Callback] Waiting for workspace to be visible for user:', user.id)
          await waitForWorkspace(supabase, user.id)
        }
      }

      const redirectUrl = isSignup ? `${origin}${next}?welcome=true` : `${origin}${next}`
      return NextResponse.redirect(redirectUrl)
    }

    console.error('[Auth Callback] Error verifying OTP:', error)
  }

  // If no code/token or error, redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
