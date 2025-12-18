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
    redirect('/login')
  }
}

