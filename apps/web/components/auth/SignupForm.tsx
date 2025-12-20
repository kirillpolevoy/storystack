'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      if (data.session && data.user) {
        // Process workspace invitations for the new user
        try {
          await supabase.rpc('process_workspace_invitations_for_user', {
            user_id: data.user.id,
            user_email: email.toLowerCase(),
          })
        } catch (inviteError) {
          // Log error but don't block signup if invitation processing fails
          console.error('Error processing workspace invitations:', inviteError)
        }
        
        setSuccess(true)
        // Wait for cookies to be set, then redirect
        setTimeout(() => {
          window.location.href = '/app/library'
        }, 1000)
      } else {
        // Email confirmation required
        setSuccess(true)
        setError(null)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign up')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm font-medium text-green-800">
        Account created! Redirecting...
      </div>
    )
  }

  return (
    <form onSubmit={handleSignup} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="signup-email" className="text-sm font-medium text-gray-700">
          Email
        </label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="signup-password" className="text-sm font-medium text-gray-700">
          Password
        </label>
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          disabled={loading}
        />
        <p className="text-xs text-gray-500">
          Must be at least 6 characters
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </Button>
    </form>
  )
}

