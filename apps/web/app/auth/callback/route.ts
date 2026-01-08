import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      // For signup confirmations, add welcome param to show welcome modal
      const isSignup = type === 'signup'
      const redirectUrl = isSignup ? `${origin}${next}?welcome=true` : `${origin}${next}`
      return NextResponse.redirect(redirectUrl)
    }

    console.error('[Auth Callback] Error verifying OTP:', error)
  }

  // If no code/token or error, redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
