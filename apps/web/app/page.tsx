import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      redirect('/app/library')
    } else {
      redirect('/login')
    }
  } catch (error) {
    // If there's an error, redirect to login
    redirect('/login')
  }
}

