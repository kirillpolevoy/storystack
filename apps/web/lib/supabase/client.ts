import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = 'Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    console.error('[createClient]', error)
    console.error('[createClient] URL:', supabaseUrl ? 'set' : 'missing')
    console.error('[createClient] Key:', supabaseAnonKey ? 'set' : 'missing')
    throw new Error(error)
  }

  console.log('[createClient] Creating Supabase client with URL:', supabaseUrl.substring(0, 30) + '...')

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

