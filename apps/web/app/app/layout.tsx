import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/app/Sidebar'

// Force dynamic rendering for all app routes
export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check for environment variables first
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[AppLayout] Missing Supabase environment variables')
    console.error('[AppLayout] Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')))
    redirect('/login')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('[AppLayout] Auth error:', authError)
      redirect('/login')
    }

    if (!user) {
      redirect('/login')
    }

    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-background">{children}</main>
      </div>
    )
  } catch (error) {
    console.error('[AppLayout] Error:', error)
    console.error('[AppLayout] Error details:', error instanceof Error ? error.message : String(error))
    console.error('[AppLayout] Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // Check if this is a redirect error (which is expected in Next.js)
    if (error && typeof error === 'object' && 'digest' in error) {
      // This is a Next.js redirect, re-throw it
      throw error
    }
    
    // For other errors, redirect to login
    redirect('/login')
  }
}

