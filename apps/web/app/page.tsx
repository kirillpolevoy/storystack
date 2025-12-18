import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // Always redirect to login - let middleware handle auth
  redirect('/login')
}

