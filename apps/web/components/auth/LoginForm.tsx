'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('[LoginForm] Attempting login for:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('[LoginForm] Login error:', error)
        throw error
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

  return (
    <form onSubmit={handleLogin} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm font-medium text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <label htmlFor="email" className="text-sm font-semibold text-foreground">
          Email
        </label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">
          Password
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  )
}

