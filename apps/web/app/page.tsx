import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  // Always redirect to login - let middleware handle auth
  redirect('/login')
}

