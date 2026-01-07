'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function SignupFormContent() {
  const searchParams = useSearchParams()
  const inviteId = searchParams?.get('invite')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) {
      return 'Password must be at least 6 characters'
    }
    return null
  }

  const passwordError = password ? validatePassword(password) : null

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        console.error('[SignupForm] Signup error:', error)
        // Provide more helpful error messages
        let errorMessage = error.message || 'Failed to sign up'
        if (error.message?.includes('500')) {
          errorMessage = 'Server error during signup. Please try again or contact support.'
        } else if (error.message?.includes('already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.'
        } else if (error.message?.includes('password')) {
          errorMessage = 'Password must be at least 6 characters long.'
        }
        throw new Error(errorMessage)
      }

      if (data.session && data.user) {
        // Process workspace invitations for the new user
        let workspaceId: string | null = null
        try {
          // If there's a specific invite ID, get the workspace ID first
          if (inviteId) {
            const { data: invitation } = await supabase
              .from('workspace_invitations')
              .select('workspace_id')
              .eq('id', inviteId)
              .eq('email', email.toLowerCase())
              .eq('status', 'pending')
              .single()
            
            if (invitation) {
              workspaceId = invitation.workspace_id
            }
          }
          
          // Process all pending invitations for this email
          console.log('[SignupForm] Calling process_workspace_invitations_for_user with:', {
            user_id: data.user.id,
            user_email: email.toLowerCase(),
            inviteId,
          })
          
          const { data: rpcData, error: rpcError } = await supabase.rpc('process_workspace_invitations_for_user', {
            user_id: data.user.id,
            user_email: email.toLowerCase(),
          })
          
          if (rpcError) {
            console.error('[SignupForm] RPC error processing invitations:', rpcError)
            console.error('[SignupForm] RPC error details:', {
              message: rpcError.message,
              code: rpcError.code,
              details: rpcError.details,
              hint: rpcError.hint,
            })
            // Don't throw - continue with signup, but log the error
          } else {
            console.log('[SignupForm] RPC call successful, rpcData:', rpcData)
            
            // Verify invitation was marked as accepted
            if (inviteId) {
              const { data: invitation } = await supabase
                .from('workspace_invitations')
                .select('status, accepted_at')
                .eq('id', inviteId)
                .single()
              
              if (invitation) {
                console.log('[SignupForm] Invitation status after processing:', invitation)
              }
            }
          }
          
          // Verify the user was added to the workspace and set as active
          if (workspaceId) {
            // Wait a moment for the database to commit
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Retry verification up to 3 times (RLS might take a moment)
            let membership: { workspace_id: string; role: string } | null = null
            let membershipError: any = null
            for (let attempt = 0; attempt < 3; attempt++) {
              const { data: membershipData, error: membershipCheckError } = await supabase
                .from('workspace_members')
                .select('workspace_id, role')
                .eq('workspace_id', workspaceId)
                .eq('user_id', data.user.id)
                .single()
              
              if (!membershipCheckError && membershipData) {
                membership = membershipData
                console.log(`[SignupForm] Verified workspace membership on attempt ${attempt + 1}:`, membership)
                break
              } else {
                membershipError = membershipCheckError
                if (attempt < 2) {
                  console.log(`[SignupForm] Membership not visible yet, retrying... (attempt ${attempt + 1}/3)`)
                  await new Promise(resolve => setTimeout(resolve, 500))
                }
              }
            }
            
            if (!membership) {
              console.error('[SignupForm] Failed to verify workspace membership after retries:', membershipError)
              // Still set workspace as active - it might be created but not visible due to RLS timing
            }
            
            // Set workspace as active in localStorage immediately
            localStorage.setItem('@storystack:active_workspace_id', workspaceId)
            window.dispatchEvent(new Event('workspace-changed'))
            
            // Also set in database for persistence
            try {
              const { error: prefError } = await supabase
                .from('user_preferences')
                .upsert({
                  user_id: data.user.id,
                  active_workspace_id: workspaceId,
                  updated_at: new Date().toISOString(),
                })
              
              if (prefError) {
                console.warn('[SignupForm] Failed to set workspace preference in database:', prefError)
              } else {
                console.log('[SignupForm] Set active workspace in database:', workspaceId)
              }
            } catch (prefError) {
              console.warn('[SignupForm] Exception setting workspace preference:', prefError)
              // Continue anyway - localStorage is set
            }
            
            console.log('[SignupForm] Set active workspace to:', workspaceId)
          }
          
          // Invalidate all workspace-related queries to force refresh
          await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
          await queryClient.invalidateQueries({ queryKey: ['workspaces', data.user.id] })
          await queryClient.invalidateQueries({ queryKey: ['user'] })
          
          console.log('[SignupForm] Processed workspace invitations, workspaceId:', workspaceId)
        } catch (inviteError: any) {
          // Log error but don't block signup if invitation processing fails
          console.error('[SignupForm] Error processing workspace invitations:', inviteError)
          console.error('[SignupForm] Error details:', {
            message: inviteError?.message,
            code: inviteError?.code,
            details: inviteError?.details,
            hint: inviteError?.hint,
          })
          // Continue with signup even if invitation processing fails
        }
        
        setSuccess(true)
        // Wait for cookies to be set and workspace to be available, then redirect
        // Give extra time for workspace membership to be visible
        setTimeout(() => {
          // Force a hard refresh to ensure workspace context picks up the new workspace
          window.location.href = '/app/library'
        }, 1500)
      } else {
        // Email confirmation required
        setSuccess(true)
        setError(null)
      }
    } catch (err: any) {
      console.error('[SignupForm] Signup failed:', err)
      setError(err.message || 'Failed to sign up. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center justify-center mb-3">
          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-900 mb-2">Account created!</h3>
        <p className="text-sm text-green-700">Redirecting to your library...</p>
      </div>
    )
  }

  const isFormValid = email.trim() && password.trim() && !passwordError

  return (
    <form onSubmit={handleSignup} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-[14px] font-normal text-red-800 animate-in fade-in slide-in-from-top-2 duration-300">
          {error}
        </div>
      )}

      {/* Email Input */}
      <div className="space-y-2.5">
        <label htmlFor="signup-email" className="block text-[12px] font-semibold text-gray-700 uppercase tracking-[0.08em]">
          Email
        </label>
        <div className="relative">
          <Input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            required
            disabled={loading}
            className={`h-[52px] px-4 text-[15px] rounded-lg border transition-all duration-200 ${
              emailFocused
                ? 'border-gray-900 ring-2 ring-gray-900/10 shadow-sm'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          />
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-2.5">
        <label htmlFor="signup-password" className="block text-[12px] font-semibold text-gray-700 uppercase tracking-[0.08em]">
          Password
        </label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            required
            minLength={6}
            disabled={loading}
            className={`h-[52px] px-4 pr-16 text-[15px] rounded-lg border transition-all duration-200 ${
              passwordFocused
                ? 'border-gray-900 ring-2 ring-gray-900/10 shadow-sm'
                : passwordError
                ? 'border-red-400 ring-2 ring-red-100'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-gray-600 hover:text-gray-900 transition-colors focus:outline-none"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {passwordError && (
          <p className="text-[13px] text-red-600 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {passwordError}
          </p>
        )}
        {!passwordError && password && (
          <p className="text-[13px] text-gray-500 mt-1.5">
            Must be at least 6 characters
          </p>
        )}
      </div>

      {/* Sign Up Button */}
      <Button
        type="submit"
        className="w-full h-[52px] text-[15px] font-semibold bg-accent hover:bg-accent/90 active:bg-accent/95 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-8 shadow-sm hover:shadow-md active:shadow-sm"
        disabled={loading || !isFormValid}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating account...
          </span>
        ) : (
          'Create Account'
        )}
      </Button>
    </form>
  )
}

export function SignupForm() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    }>
      <SignupFormContent />
    </Suspense>
  )
}

