'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Check if Supabase URL is available
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('Supabase configuration is missing. Please check your environment variables.')
      }
      
      console.log('[LoginForm] Attempting login for:', email)
      console.log('[LoginForm] Supabase URL:', supabaseUrl.substring(0, 30) + '...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('[LoginForm] Login error:', error)
        console.error('[LoginForm] Error message:', error.message)
        console.error('[LoginForm] Error status:', error.status)
        
        // Provide more user-friendly error messages
        let errorMessage = error.message || 'Failed to sign in'
        if (error.status === 400 && error.message?.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.'
        } else if (error.status === 429) {
          errorMessage = 'Too many login attempts. Please wait a moment and try again.'
        } else if (error.status === 500) {
          errorMessage = 'Server error. Please try again later or contact support.'
        }
        
        throw new Error(errorMessage)
      }

      console.log('[LoginForm] Login successful, session:', data.session ? 'exists' : 'missing')
      
      if (data.session) {
        // Verify session is set
        const { data: { session: verifySession } } = await supabase.auth.getSession()
        console.log('[LoginForm] Verified session:', verifySession ? 'exists' : 'missing')
        
        // Wait a bit for cookies to be set
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Use full page reload to ensure cookies are properly set
        window.location.href = '/app/library'
      } else {
        throw new Error('No session created')
      }
    } catch (err: any) {
      console.error('[LoginForm] Error:', err)
      setError(err.message || 'Failed to sign in')
      setLoading(false)
    }
  }

  const isFormValid = email.trim() && password.trim()

  return (
    <form onSubmit={handleLogin} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-[14px] font-normal text-red-800 animate-in fade-in slide-in-from-top-2 duration-300">
          {error}
        </div>
      )}

      {/* Email Input */}
      <div className="space-y-2.5">
        <label htmlFor="email" className="block text-[12px] font-semibold text-gray-700 uppercase tracking-[0.08em]">
          Email
        </label>
        <div className="relative">
          <Input
            id="email"
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
        <label htmlFor="password" className="block text-[12px] font-semibold text-gray-700 uppercase tracking-[0.08em]">
          Password
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            required
            disabled={loading}
            className={`h-[52px] px-4 pr-16 text-[15px] rounded-lg border transition-all duration-200 ${
              passwordFocused
                ? 'border-gray-900 ring-2 ring-gray-900/10 shadow-sm'
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
      </div>

      {/* Sign In Button */}
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
            Signing in...
          </span>
        ) : (
          'Sign In'
        )}
      </Button>
    </form>
  )
}

