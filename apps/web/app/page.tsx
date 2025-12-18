import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  console.log('[HomePage] Root page component executing')
  
  try {
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
        } = await supabase.auth.getUser()

        console.log('[HomePage] User check result:', !!user)
        if (user) {
          console.log('[HomePage] User found, redirecting to /app/library')
          redirect('/app/library')
        }
      } catch (error) {
        // If auth check fails, continue to redirect to login
        console.error('[HomePage] Auth check failed:', error)
        console.error('[HomePage] Error details:', error instanceof Error ? error.message : String(error))
      }
    }
    
    // Default: redirect to login
    console.log('[HomePage] Redirecting to /login (default)')
    redirect('/login')
  } catch (error) {
    // If redirect fails, try again
    console.error('[HomePage] Redirect error:', error)
    console.error('[HomePage] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[HomePage] Error message:', error instanceof Error ? error.message : String(error))
    try {
      redirect('/login')
    } catch (redirectError) {
      console.error('[HomePage] Second redirect also failed:', redirectError)
      throw redirectError
    }
  }
}

