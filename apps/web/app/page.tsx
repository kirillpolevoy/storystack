import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  try {
    // Try to get user, but don't fail if env vars are missing
    const hasEnvVars = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (hasEnvVars) {
      try {
        const supabase = await createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          redirect('/app/library')
        }
      } catch (error) {
        // If auth check fails, continue to redirect to login
        console.error('[HomePage] Auth check failed:', error)
      }
    }
    
    // Default: redirect to login
    redirect('/login')
  } catch (error) {
    // If redirect fails, try again
    console.error('[HomePage] Redirect error:', error)
    redirect('/login')
  }
}

