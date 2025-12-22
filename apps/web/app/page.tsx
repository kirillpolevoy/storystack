import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  console.log('[HomePage] Root page component executing')
  
  // Try to get user, but don't fail if env vars are missing
  const hasEnvVars = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  console.log('[HomePage] Has env vars:', hasEnvVars)
  
  if (hasEnvVars) {
    try {
      console.log('[HomePage] Attempting to create Supabase client')
      const supabase = await createClient()
      console.log('[HomePage] Supabase client created, checking user')
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        console.error('[HomePage] Auth error:', authError)
        // Continue to redirect to login on auth error
      } else {
        console.log('[HomePage] User check result:', !!user)
        if (user) {
          console.log('[HomePage] User found, redirecting to /app/library')
          redirect('/app/library')
        }
      }
    } catch (error) {
      // If auth check fails, log and continue to redirect to login
      // Don't re-throw as redirect() throws a special error that Next.js handles
      console.error('[HomePage] Auth check failed:', error)
      console.error('[HomePage] Error details:', error instanceof Error ? error.message : String(error))
      
      // Check if this is a redirect error (which is expected)
      if (error && typeof error === 'object' && 'digest' in error) {
        // This is a Next.js redirect, re-throw it
        throw error
      }
    }
  }
  
  // Default: redirect to login
  // Note: redirect() throws a NEXT_REDIRECT error which Next.js handles
  console.log('[HomePage] Redirecting to /login (default)')
  redirect('/login')
}

